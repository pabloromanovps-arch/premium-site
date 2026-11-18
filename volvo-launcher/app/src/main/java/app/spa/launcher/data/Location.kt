package app.spa.launcher.data

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Bundle
import android.os.Looper
import androidx.core.content.ContextCompat
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.Locale
import kotlin.math.roundToInt

data class Gps(val speedKmh: Int, val bearing: Float?, val fix: Boolean)

class LocationRepo(private val ctx: Context) {
    private val lm = ctx.getSystemService(LocationManager::class.java)
    val gps = MutableStateFlow<Gps?>(null)
    val granted = MutableStateFlow(checkGranted())
    private var running = false

    // На Android 10 у LocationListener нет методов по умолчанию, поэтому реализуем все.
    private val listener = object : LocationListener {
        override fun onLocationChanged(loc: Location) {
            val moving = loc.hasSpeed() && loc.speed > 1.5f
            gps.value = Gps(
                speedKmh = if (loc.hasSpeed()) (loc.speed * 3.6f).roundToInt() else 0,
                bearing = if (moving && loc.hasBearing()) loc.bearing else gps.value?.bearing,
                fix = true,
            )
        }
        @Deprecated("API < 29")
        override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
        override fun onProviderEnabled(provider: String) {}
        override fun onProviderDisabled(provider: String) {
            gps.value = gps.value?.copy(fix = false)
        }
    }

    private fun checkGranted() =
        ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED

    @SuppressLint("MissingPermission")
    fun start() {
        granted.value = checkGranted()
        if (!granted.value || running) return
        runCatching {
            lm.requestLocationUpdates(LocationManager.GPS_PROVIDER, 1000L, 0f, listener, Looper.getMainLooper())
            running = true
        }
    }

    fun stop() {
        if (!running) return
        runCatching { lm.removeUpdates(listener) }
        running = false
    }

    @SuppressLint("MissingPermission")
    fun lastKnown(): Location? {
        if (!checkGranted()) return null
        return listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER, LocationManager.PASSIVE_PROVIDER)
            .mapNotNull { runCatching { lm.getLastKnownLocation(it) }.getOrNull() }
            .maxByOrNull { it.time }
    }
}

data class Weather(val temp: Int, val desc: String)

object WeatherApi {
    /** Open-Meteo: бесплатно и без ключа. */
    suspend fun fetch(lat: Double, lon: Double): Weather? = withContext(Dispatchers.IO) {
        runCatching {
            val url = URL(
                String.format(
                    Locale.US,
                    "https://api.open-meteo.com/v1/forecast?latitude=%.3f&longitude=%.3f&current=temperature_2m,weather_code",
                    lat, lon,
                )
            )
            val conn = (url.openConnection() as HttpURLConnection).apply {
                connectTimeout = 8000
                readTimeout = 8000
            }
            val text = conn.inputStream.bufferedReader().use { it.readText() }
            val cur = JSONObject(text).getJSONObject("current")
            Weather(cur.getDouble("temperature_2m").roundToInt(), describe(cur.getInt("weather_code")))
        }.getOrNull()
    }

    private fun describe(code: Int) = when (code) {
        0 -> "Ясно"
        1, 2 -> "Переменная облачность"
        3 -> "Пасмурно"
        45, 48 -> "Туман"
        51, 53, 55, 56, 57 -> "Морось"
        61, 63, 65, 66, 67, 80, 81, 82 -> "Дождь"
        71, 73, 75, 77, 85, 86 -> "Снег"
        95, 96, 99 -> "Гроза"
        else -> ""
    }
}
