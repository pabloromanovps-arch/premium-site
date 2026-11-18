package app.spa.launcher

import android.app.Application
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.media.AudioManager
import android.provider.Settings
import androidx.core.content.ContextCompat
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import app.spa.launcher.data.AppEntry
import app.spa.launcher.data.AppRepo
import app.spa.launcher.data.LocationRepo
import app.spa.launcher.data.MediaRepo
import app.spa.launcher.data.Prefs
import app.spa.launcher.data.Weather
import app.spa.launcher.data.WeatherApi
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

data class Volume(val value: Int, val max: Int)

class LauncherVm(private val app: Application) : AndroidViewModel(app) {
    val prefs = Prefs(app)
    val media = MediaRepo(app)
    val location = LocationRepo(app)
    private val am = app.getSystemService(AudioManager::class.java)

    val apps = MutableStateFlow<List<AppEntry>>(emptyList())
    val volume = MutableStateFlow(readVolume())
    val brightness = MutableStateFlow(readBrightness())
    val canWriteSettings = MutableStateFlow(Settings.System.canWrite(app))
    val weather = MutableStateFlow<Weather?>(null)
    val now = MutableStateFlow(System.currentTimeMillis())

    private val volumeReceiver = object : BroadcastReceiver() {
        override fun onReceive(c: Context, i: Intent) {
            volume.value = readVolume()
        }
    }
    private val packageReceiver = object : BroadcastReceiver() {
        override fun onReceive(c: Context, i: Intent) = reloadApps()
    }

    init {
        reloadApps()
        ContextCompat.registerReceiver(
            app, volumeReceiver, IntentFilter("android.media.VOLUME_CHANGED_ACTION"), ContextCompat.RECEIVER_EXPORTED,
        )
        ContextCompat.registerReceiver(
            app, packageReceiver,
            IntentFilter().apply {
                addAction(Intent.ACTION_PACKAGE_ADDED)
                addAction(Intent.ACTION_PACKAGE_REMOVED)
                addAction(Intent.ACTION_PACKAGE_CHANGED)
                addDataScheme("package")
            },
            ContextCompat.RECEIVER_EXPORTED,
        )
        // Часы: обновление точно на границе минуты, без лишних перерисовок.
        viewModelScope.launch {
            while (true) {
                now.value = System.currentTimeMillis()
                delay(60_000 - now.value % 60_000 + 50)
            }
        }
        // Погода раз в 30 минут (раз в 2 минуты, пока нет данных).
        viewModelScope.launch {
            while (true) {
                location.lastKnown()?.let { loc ->
                    WeatherApi.fetch(loc.latitude, loc.longitude)?.let { weather.value = it }
                }
                delay(if (weather.value == null) 120_000 else 1_800_000)
            }
        }
    }

    fun reloadApps() {
        viewModelScope.launch {
            apps.value = withContext(Dispatchers.IO) { AppRepo.load(app) }
        }
    }

    fun onResume() {
        now.value = System.currentTimeMillis()
        volume.value = readVolume()
        brightness.value = readBrightness()
        canWriteSettings.value = Settings.System.canWrite(app)
        media.start()
        location.start()
    }

    fun onPause() {
        location.stop()
    }

    private fun readVolume() = Volume(am.getStreamVolume(AudioManager.STREAM_MUSIC), am.getStreamMaxVolume(AudioManager.STREAM_MUSIC))

    fun setVolume(v: Int) {
        val max = am.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
        val c = v.coerceIn(0, max)
        runCatching { am.setStreamVolume(AudioManager.STREAM_MUSIC, c, 0) }
        volume.value = readVolume()
    }

    private fun readBrightness() =
        runCatching { Settings.System.getInt(app.contentResolver, Settings.System.SCREEN_BRIGHTNESS) }.getOrDefault(128)

    /** false, если нет разрешения на изменение системных настроек. */
    fun setBrightness(v: Int): Boolean {
        if (!Settings.System.canWrite(app)) return false
        runCatching {
            Settings.System.putInt(app.contentResolver, Settings.System.SCREEN_BRIGHTNESS_MODE, Settings.System.SCREEN_BRIGHTNESS_MODE_MANUAL)
            Settings.System.putInt(app.contentResolver, Settings.System.SCREEN_BRIGHTNESS, v.coerceIn(5, 255))
        }
        brightness.value = readBrightness()
        return true
    }

    override fun onCleared() {
        runCatching { app.unregisterReceiver(volumeReceiver) }
        runCatching { app.unregisterReceiver(packageReceiver) }
        location.stop()
    }
}
