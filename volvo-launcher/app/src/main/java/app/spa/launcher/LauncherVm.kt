package app.spa.launcher

import android.app.Application
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.provider.Settings
import androidx.core.content.ContextCompat
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import app.spa.launcher.data.AppEntry
import app.spa.launcher.data.AppRepo
import app.spa.launcher.data.LaunchTarget
import app.spa.launcher.data.MediaBus
import app.spa.launcher.data.Slot
import app.spa.launcher.data.MediaRepo
import app.spa.launcher.data.NetInfo
import app.spa.launcher.data.Prefs
import app.spa.launcher.data.Weather
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.TimeZone
import kotlin.math.abs

class LauncherVm(private val app: Application) : AndroidViewModel(app) {
    val prefs = Prefs(app)
    val media = MediaRepo(app, viewModelScope)

    val apps = MutableStateFlow<List<AppEntry>>(emptyList())
    val brightness = MutableStateFlow(readBrightness())
    val canWriteSettings = MutableStateFlow(Settings.System.canWrite(app))
    val weather = MutableStateFlow<Weather?>(null)

    /** Поправка к часам магнитолы по времени из интернета (если они сбиты). */
    private var clockOffset = 0L
    val zone = MutableStateFlow<TimeZone>(TimeZone.getDefault())
    val now = MutableStateFlow(currentTime())
    private var clockJob: Job? = null

    private val packageReceiver = object : BroadcastReceiver() {
        override fun onReceive(c: Context, i: Intent) = reloadApps()
    }

    init {
        reloadApps()
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
        startClock()
        // Пакет Bluetooth Music: трек из его уведомлений и куда вести по нажатию на карточку.
        viewModelScope.launch {
            combine(apps, prefs.settings) { list, st -> Slot.BT_MUSIC.resolve(list, st.slots) as? LaunchTarget.App }
                .collect { bt ->
                    media.fallbackPkg = bt?.pkg
                    MediaBus.musicPkgs = setOfNotNull(bt?.pkg)
                }
        }
        // Город, точное время и погода раз в 30 минут (раз в минуту, пока нет интернета).
        viewModelScope.launch {
            while (true) {
                val geo = NetInfo.geo()
                if (geo != null) {
                    geo.serverTime?.let { server ->
                        val diff = server - System.currentTimeMillis()
                        clockOffset = if (abs(diff) > 90_000) diff else 0L
                    }
                    geo.timezone?.let { id -> zone.value = TimeZone.getTimeZone(id) }
                    startClock()
                    NetInfo.weather(geo)?.let { weather.value = it }
                }
                delay(if (weather.value == null) 60_000 else 1_800_000)
            }
        }
    }

    private fun currentTime() = System.currentTimeMillis() + clockOffset

    /** Часы обновляются ровно на границе минуты — без лишних перерисовок. */
    private fun startClock() {
        clockJob?.cancel()
        clockJob = viewModelScope.launch {
            while (true) {
                val t = currentTime()
                now.value = t
                delay(60_000 - t % 60_000 + 50)
            }
        }
    }

    fun reloadApps() {
        viewModelScope.launch {
            apps.value = withContext(Dispatchers.IO) { AppRepo.load(app) }
        }
    }

    fun onResume() {
        startClock()
        brightness.value = readBrightness()
        canWriteSettings.value = Settings.System.canWrite(app)
        media.start()
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
        runCatching { app.unregisterReceiver(packageReceiver) }
        media.close()
    }
}
