package app.spa.launcher.data

import android.content.Context
import android.content.Intent
import android.provider.Settings
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.core.graphics.drawable.toBitmap
import app.spa.launcher.ui.Ic

data class AppEntry(
    val label: String,
    val pkg: String,
    val cls: String,
    val icon: ImageBitmap,
) {
    val key: String get() = "$pkg/$cls"
}

object AppRepo {
    /** Все приложения с иконкой в лаунчере, кроме нас самих. Вызывать не на главном потоке. */
    fun load(ctx: Context): List<AppEntry> {
        val pm = ctx.packageManager
        val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
        return pm.queryIntentActivities(intent, 0)
            .filter { it.activityInfo.packageName != ctx.packageName }
            .mapNotNull { ri ->
                runCatching {
                    val icon = ri.loadIcon(pm).toBitmap(96, 96).asImageBitmap()
                    AppEntry(ri.loadLabel(pm).toString().trim(), ri.activityInfo.packageName, ri.activityInfo.name, icon)
                }.getOrNull()
            }
            .distinctBy { it.key }
            .sortedBy { it.label.lowercase() }
    }
}

sealed interface LaunchTarget {
    data class App(val pkg: String, val cls: String, val label: String) : LaunchTarget
    data class Url(val url: String) : LaunchTarget
    data class Action(val action: String) : LaunchTarget
}

private val I = RegexOption.IGNORE_CASE

/**
 * Ярлыки главного меню. Каждый сам ищет нужное приложение на магнитоле:
 * сначала по выбору пользователя (долгое нажатие), потом по имени пакета, потом по названию.
 */
enum class Slot(
    val title: String,
    val icon: ImageVector,
    val pkgs: List<String> = emptyList(),
    val regex: Regex? = null,
    val url: String? = null,
    val action: String? = null,
) {
    NAV("Навигатор", Ic.Nav, listOf("ru.yandex.yandexnavi", "ru.yandex.yandexmaps"), Regex("навигатор|navi", I)),
    CARPLAY("CarPlay", Ic.CarPlay, listOf("com.zjinnova.zlink", "com.tplink.tlink"), Regex("carplay|t-?link|zlink|tp-?link", I)),
    YOUTUBE("YouTube", Ic.YouTube, url = "https://m.youtube.com"),
    FRONT_CAM("Передняя камера", Ic.Camera, regex = Regex("передн|front", I)),
    BT_MUSIC("Музыка Bluetooth", Ic.Headphones, regex = Regex("bluetooth ?music|bt ?music|музык\\w* ?bluetooth|bluetooth[- ]музык", I)),
    YMUSIC("Яндекс Музыка", Ic.Music, listOf("ru.yandex.music"), Regex("яндекс.?музык|yandex.?music", I)),
    ZVUK("СберЗвук", Ic.Wave, listOf("com.zvooq.openplay"), Regex("сбер.?звук|zvuk|zvooq", I)),
    DISK("Диск", Ic.Cloud, listOf("ru.yandex.disk"), Regex("диск|disk", I)),
    PHONE("Телефон", Ic.Phone, regex = Regex("телефон|phone|dialer|^bluetooth$|^bt$", I)),
    SETTINGS("Настройки", Ic.Gear, action = Settings.ACTION_SETTINGS);

    fun resolve(apps: List<AppEntry>, overrides: Map<String, String>): LaunchTarget? {
        fun AppEntry.t() = LaunchTarget.App(pkg, cls, label)
        overrides[name]?.let { o -> apps.firstOrNull { it.key == o }?.let { return it.t() } }
        pkgs.forEach { p -> apps.firstOrNull { it.pkg == p }?.let { return it.t() } }
        regex?.let { r -> apps.firstOrNull { r.containsMatchIn(it.label) }?.let { return it.t() } }
        url?.let { return LaunchTarget.Url(it) }
        action?.let { return LaunchTarget.Action(it) }
        return null
    }

    companion object {
        val favorites = listOf(NAV, CARPLAY, YOUTUBE, FRONT_CAM, BT_MUSIC, YMUSIC, ZVUK, DISK, PHONE, SETTINGS)
    }
}
