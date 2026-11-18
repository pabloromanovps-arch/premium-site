package app.spa.launcher.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.Locale
import kotlin.math.roundToInt

data class Weather(
    val temp: Int,
    val feels: Int,
    val wind: Int,
    val desc: String,
    val city: String,
)

/** Город, часовой пояс и точное время по интернету. GPS и правильные часы магнитолы не нужны. */
data class GeoInfo(
    val lat: Double,
    val lon: Double,
    val city: String,
    val timezone: String?,
    val serverTime: Long?,
)

/**
 * Несколько независимых сервисов: если один недоступен у провайдера или из-за сбитых часов
 * (https не проходит), пробуем следующий. Причины неудач видны в диагностике.
 */
object NetInfo {
    /** Почему не удалось — для окна диагностики. */
    @Volatile var log: List<String> = emptyList()
        private set

    private fun note(line: String) {
        log = (log + line).takeLast(14)
    }

    /** Коротко, что пошло не так в последней попытке — для плитки погоды. */
    fun lastProblem(): String = log.lastOrNull { !it.endsWith(": ок") }.orEmpty().take(70)

    private fun open(url: String) = (URL(url).openConnection() as HttpURLConnection).apply {
        connectTimeout = 5000
        readTimeout = 7000
        useCaches = false
        instanceFollowRedirects = true
    }

    private fun fetch(url: String): Pair<String, Long?> {
        val c = open(url)
        val text = c.inputStream.bufferedReader().use { it.readText() }
        return text to c.date.takeIf { it > 0 }
    }

    private inline fun <T> attempt(name: String, block: () -> T?): T? =
        runCatching(block)
            .onSuccess { note("$name: " + if (it != null) "ок" else "пустой ответ") }
            .onFailure { note("$name: ${it.javaClass.simpleName} ${it.message.orEmpty().take(60)}") }
            .getOrNull()

    suspend fun geo(): GeoInfo? = withContext(Dispatchers.IO) {
        attempt("ip-api.com") {
            val (text, date) = fetch("http://ip-api.com/json/?fields=status,lat,lon,city,timezone&lang=ru")
            val j = JSONObject(text)
            if (j.optString("status") != "success") null
            else GeoInfo(j.getDouble("lat"), j.getDouble("lon"), j.optString("city"), j.optString("timezone").ifBlank { null }, date)
        } ?: attempt("ipwho.is") {
            val (text, date) = fetch("http://ipwho.is/?lang=ru")
            val j = JSONObject(text)
            if (!j.optBoolean("success")) null
            else GeoInfo(
                j.getDouble("latitude"), j.getDouble("longitude"), j.optString("city"),
                j.optJSONObject("timezone")?.optString("id")?.ifBlank { null }, date,
            )
        } ?: attempt("ipinfo.io") {
            val (text, date) = fetch("http://ipinfo.io/json")
            val j = JSONObject(text)
            val loc = j.optString("loc").split(",")
            if (loc.size != 2) null
            else GeoInfo(loc[0].toDouble(), loc[1].toDouble(), j.optString("city"), j.optString("timezone").ifBlank { null }, date)
        } ?: attempt("ipapi.co") {
            val (text, date) = fetch("https://ipapi.co/json/")
            val j = JSONObject(text)
            if (!j.has("latitude")) null
            else GeoInfo(j.getDouble("latitude"), j.getDouble("longitude"), j.optString("city"), j.optString("timezone").ifBlank { null }, date)
        }
    }

    suspend fun weather(g: GeoInfo): Weather? = withContext(Dispatchers.IO) {
        // wttr.in первым: на этой магнитоле он отвечает, а open-meteo — нет (таймаут).
        wttr("%.3f,%.3f".format(Locale.US, g.lat, g.lon), g.city) ?: openMeteo(g) ?: sevenTimer(g)
    }

    /** Если город не определился ни одним сервисом: wttr.in сам найдёт место по адресу подключения. */
    suspend fun weatherByIp(): Weather? = withContext(Dispatchers.IO) { wttr("", null) }

    /** Погода по названию города, который пользователь указал сам (IP оператора часто «живёт» в другом городе). */
    suspend fun weatherByCity(city: String): Weather? = withContext(Dispatchers.IO) {
        val q = java.net.URLEncoder.encode(city.trim(), "UTF-8")
        wttr(q, city) ?: geocode(q, city)?.let { g -> openMeteo(g) ?: sevenTimer(g) }
    }

    /** Координаты города: геокодер Open-Meteo (https, затем http). */
    private fun geocode(q: String, city: String): GeoInfo? {
        for (scheme in listOf("https://", "http://")) {
            val g = attempt("геокодер ($scheme)") {
                val res = JSONObject(fetch("${scheme}geocoding-api.open-meteo.com/v1/search?name=$q&count=1&language=ru").first)
                    .optJSONArray("results")
                if (res == null || res.length() == 0) null
                else res.getJSONObject(0).let { r ->
                    GeoInfo(r.getDouble("latitude"), r.getDouble("longitude"), r.optString("name").ifBlank { city }, r.optString("timezone").ifBlank { null }, null)
                }
            }
            if (g != null) return g
        }
        return null
    }

    private fun openMeteo(g: GeoInfo): Weather? {
        val path = String.format(
            Locale.US,
            "api.open-meteo.com/v1/forecast?latitude=%.3f&longitude=%.3f" +
                "&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m&wind_speed_unit=ms",
            g.lat, g.lon,
        )
        for (scheme in listOf("https://", "http://")) {
            val w = attempt("open-meteo ($scheme)") {
                val cur = JSONObject(fetch(scheme + path).first).getJSONObject("current")
                Weather(
                    temp = cur.getDouble("temperature_2m").roundToInt(),
                    feels = cur.getDouble("apparent_temperature").roundToInt(),
                    wind = cur.getDouble("wind_speed_10m").roundToInt(),
                    desc = describe(cur.getInt("weather_code")),
                    city = g.city,
                )
            }
            if (w != null) return w
        }
        return null
    }

    /** wttr.in отвечает по обычному http, даже если часы магнитолы сбиты. */
    private fun wttr(place: String, city: String?): Weather? = attempt("wttr.in") {
        val root = JSONObject(fetch("http://wttr.in/$place?format=j1&lang=ru").first)
        val cc = root.getJSONArray("current_condition").getJSONObject(0)
        val desc = cc.optJSONArray("lang_ru")?.optJSONObject(0)?.optString("value")
            ?: cc.optJSONArray("weatherDesc")?.optJSONObject(0)?.optString("value")
            ?: ""
        val area = root.optJSONArray("nearest_area")?.optJSONObject(0)?.optJSONArray("areaName")?.optJSONObject(0)?.optString("value")
        Weather(
            temp = cc.getString("temp_C").toInt(),
            feels = cc.getString("FeelsLikeC").toInt(),
            wind = (cc.getString("windspeedKmph").toDouble() / 3.6).roundToInt(),
            desc = desc.replaceFirstChar { it.uppercase() },
            city = city?.ifBlank { null } ?: area.orEmpty(),
        )
    }

    /** 7timer.info — ещё один бесплатный сервис по обычному http. */
    private fun sevenTimer(g: GeoInfo): Weather? = attempt("7timer.info") {
        val url = String.format(Locale.US, "http://www.7timer.info/bin/api.pl?lon=%.3f&lat=%.3f&product=civil&output=json", g.lon, g.lat)
        val d = JSONObject(fetch(url).first).getJSONArray("dataseries").getJSONObject(0)
        val t = d.getInt("temp2m")
        val windIdx = d.optJSONObject("wind10m")?.optInt("speed") ?: 1
        val wind = listOf(0, 0, 2, 5, 9, 14, 20, 28, 35).getOrElse(windIdx) { 5 }
        val w = d.optString("weather")
        val desc = when {
            w.startsWith("clear") -> "Ясно"
            w.startsWith("pcloudy") -> "Переменная облачность"
            w.startsWith("mcloudy") -> "Облачно"
            w.startsWith("cloudy") -> "Пасмурно"
            w.startsWith("humid") -> "Туман"
            w.startsWith("rainsnow") -> "Дождь со снегом"
            w.startsWith("ts") -> "Гроза"
            w.contains("snow") -> "Снег"
            w.contains("rain") || w.contains("shower") -> "Дождь"
            else -> ""
        }
        Weather(temp = t, feels = t, wind = wind, desc = desc, city = g.city)
    }

    private fun describe(code: Int) = when (code) {
        0 -> "Ясно"
        1 -> "Преимущественно ясно"
        2 -> "Переменная облачность"
        3 -> "Пасмурно"
        45, 48 -> "Туман"
        51, 53, 55, 56, 57 -> "Морось"
        61, 63, 65, 66, 67, 80, 81, 82 -> "Дождь"
        71, 73, 75, 77, 85, 86 -> "Снег"
        95, 96, 99 -> "Гроза"
        else -> ""
    }
}
