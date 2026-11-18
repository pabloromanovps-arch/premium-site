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
        log = (log + line).takeLast(12)
    }

    private fun open(url: String) = (URL(url).openConnection() as HttpURLConnection).apply {
        connectTimeout = 8000
        readTimeout = 8000
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
        } ?: attempt("ipapi.co") {
            val (text, date) = fetch("https://ipapi.co/json/")
            val j = JSONObject(text)
            if (!j.has("latitude")) null
            else GeoInfo(j.getDouble("latitude"), j.getDouble("longitude"), j.optString("city"), j.optString("timezone").ifBlank { null }, date)
        }
    }

    suspend fun weather(g: GeoInfo): Weather? = withContext(Dispatchers.IO) {
        openMeteo(g) ?: wttr("%.3f,%.3f".format(Locale.US, g.lat, g.lon), g.city)
    }

    /** Если город не определился ни одним сервисом: wttr.in сам найдёт место по адресу подключения. */
    suspend fun weatherByIp(): Weather? = withContext(Dispatchers.IO) { wttr("", null) }

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
