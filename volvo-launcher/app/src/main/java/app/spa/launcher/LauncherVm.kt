package app.spa.launcher

import android.app.Application
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.wifi.WifiManager
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

/** Состояние сети для значка в верхней строке. */
data class NetState(val wifi: Boolean = false, val cellular: Boolean = false, val internet: Boolean = false, val level: Int = 0)

class LauncherVm(private val app: Application) : AndroidViewModel(app) {
    private val cm = app.getSystemService(ConnectivityManager::class.java)
    private val wm = app.applicationContext.getSystemService(WifiManager::class.java)
    val net = MutableStateFlow(NetState())
    private val netCallback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) = updateNet()
        override fun onCapabilitiesChanged(network: Network, caps: NetworkCapabilities) = updateNet()
        override fun onLost(network: Network) = updateNet()
    }

    val prefs = Prefs(app)
    val media = MediaRepo(app, viewModelScope)

    val apps = MutableStateFlow<List<AppEntry>>(emptyList())
    val brightness = MutableStateFlow(readBrightness())
    val canWriteSettings = MutableStateFlow(Settings.System.canWrite(app))
    val weather = MutableStateFlow<Weather?>(null)
    /** Почему погоды нет: показываем прямо в плитке. */
    val weatherStatus = MutableStateFlow("Определяем город…")

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
        runCatching { cm.registerDefaultNetworkCallback(netCallback) }
        updateNet()
        // Значок сети раз в минуту (Wi-Fi лаунчер не трогает — им пользуется CarPlay).
        viewModelScope.launch {
            while (true) {
                delay(60_000)
                updateNet()
            }
        }
        // Пакет Bluetooth Music: трек из его уведомлений и куда вести по нажатию на карточку.
        viewModelScope.launch {
            combine(apps, prefs.settings) { list, st ->
                (Slot.BT_MUSIC.resolve(list, st.slots) as? LaunchTarget.App)?.pkg to st.phoneOnly
            }.collect { (bt, phoneOnly) ->
                media.fallbackPkg = bt
                media.phonePkgs = setOfNotNull(bt, "com.android.bluetooth")
                media.phoneOnly = phoneOnly
                MediaBus.musicPkgs = setOfNotNull(bt)
                media.refresh()
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
                }
                val w = if (geo != null) NetInfo.weather(geo) else NetInfo.weatherByIp()
                if (w != null) {
                    weather.value = w
                    weatherStatus.value = ""
                } else if (weather.value == null) {
                    weatherStatus.value = if (net.value.internet) "Сервисы погоды не ответили. Подробнее: Функции → Диагностика"
                    else "Нет интернета. Подключите Wi-Fi"
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

    @Suppress("DEPRECATION")
    fun updateNet() {
        val caps = runCatching { cm.getNetworkCapabilities(cm.activeNetwork) }.getOrNull()
        val wifi = caps?.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) == true
        val level = if (wifi) runCatching { WifiManager.calculateSignalLevel(wm.connectionInfo.rssi, 4) }.getOrDefault(3) else 0
        net.value = NetState(
            wifi = wifi,
            cellular = caps?.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) == true,
            internet = caps?.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED) == true ||
                caps?.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) == true,
            level = level,
        )
    }

    fun onResume() {
        updateNet()
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
        runCatching { cm.unregisterNetworkCallback(netCallback) }
    }
}
