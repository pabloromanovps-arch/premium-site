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
 * Запросы идут по обычному http: если часы магнитолы сбиты, https-сертификаты
 * считаются «недействительными» и защищённые запросы не проходят.
 */
object NetInfo {
    private fun open(url: String) = (URL(url).openConnection() as HttpURLConnection).apply {
        connectTimeout = 8000
        readTimeout = 8000
        useCaches = false
    }

    suspend fun geo(): GeoInfo? = withContext(Dispatchers.IO) {
        runCatching {
            val c = open("http://ip-api.com/json/?fields=status,lat,lon,city,timezone&lang=ru")
            val text = c.inputStream.bufferedReader().use { it.readText() }
            val date = c.date.takeIf { it > 0 }
            val j = JSONObject(text)
            if (j.optString("status") != "success") return@runCatching null
            GeoInfo(j.getDouble("lat"), j.getDouble("lon"), j.optString("city"), j.optString("timezone").ifBlank { null }, date)
        }.getOrNull()
    }

    suspend fun weather(g: GeoInfo): Weather? = openMeteo(g) ?: wttr(g)

    /** Запасной источник: wttr.in отвечает по обычному http, даже если часы магнитолы сбиты. */
    private suspend fun wttr(g: GeoInfo): Weather? = withContext(Dispatchers.IO) {
        runCatching {
            val url = String.format(Locale.US, "http://wttr.in/%.3f,%.3f?format=j1&lang=ru", g.lat, g.lon)
            val text = open(url).inputStream.bufferedReader().use { it.readText() }
            val cc = JSONObject(text).getJSONArray("current_condition").getJSONObject(0)
            val desc = cc.optJSONArray("lang_ru")?.optJSONObject(0)?.optString("value")
                ?: cc.optJSONArray("weatherDesc")?.optJSONObject(0)?.optString("value")
                ?: ""
            Weather(
                temp = cc.getString("temp_C").toInt(),
                feels = cc.getString("FeelsLikeC").toInt(),
                wind = (cc.getString("windspeedKmph").toDouble() / 3.6).roundToInt(),
                desc = desc.replaceFirstChar { it.uppercase() },
                city = g.city,
            )
        }.getOrNull()
    }

    private suspend fun openMeteo(g: GeoInfo): Weather? = withContext(Dispatchers.IO) {
        runCatching {
            val path = String.format(
                Locale.US,
                "api.open-meteo.com/v1/forecast?latitude=%.3f&longitude=%.3f" +
                    "&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m&wind_speed_unit=ms",
                g.lat, g.lon,
            )
            // Сначала https (http у сервиса перенаправляет), запасной вариант — http.
            val text = listOf("https://$path", "http://$path").firstNotNullOfOrNull { url ->
                runCatching { open(url).inputStream.bufferedReader().use { it.readText() } }.getOrNull()
            } ?: error("weather unavailable")
            val cur = JSONObject(text).getJSONObject("current")
            Weather(
                temp = cur.getDouble("temperature_2m").roundToInt(),
                feels = cur.getDouble("apparent_temperature").roundToInt(),
                wind = cur.getDouble("wind_speed_10m").roundToInt(),
                desc = describe(cur.getInt("weather_code")),
                city = g.city,
            )
        }.getOrNull()
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
