package app.spa.launcher.ui

import android.provider.Settings
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyGridScope
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.focus.focusRequester
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.horizontalScroll
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.spa.launcher.LauncherVm
import app.spa.launcher.data.LaunchTarget
import app.spa.launcher.data.Slot

const val RELEASES_URL = "https://github.com/pabloromanovps-arch/premium-site/releases/tag/launcher-latest"

private fun LazyGridScope.header(text: String) {
    item(span = { GridItemSpan(maxLineSpan) }) {
        T(text, 13.sp, C.dim, FontWeight.Medium, Modifier.padding(start = 4.dp, top = 6.dp, bottom = 2.dp))
    }
}

// ───────────────────────────── Приложения ─────────────────────────────

@Composable
fun AppsPage(vm: LauncherVm) {
    val a = LocalActions.current
    val apps by vm.apps.collectAsStateWithLifecycle()
    val s by vm.prefs.settings.collectAsStateWithLifecycle()
    LazyVerticalGrid(
        columns = GridCells.Fixed(10),
        modifier = Modifier.fillMaxSize().padding(horizontal = 6.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
        contentPadding = PaddingValues(bottom = 8.dp),
    ) {
        header("Избранное · удерживайте ярлык, чтобы выбрать приложение")
        items(Slot.favorites, key = { "slot-" + it.name }) { slot ->
            val t = slot.resolve(apps, s.slots)
            AppCell(
                label = slot.title,
                vector = slot.icon,
                sub = if (t == null) "не выбрано" else null,
                onLong = { a.pick(slot) },
            ) { r -> a.launchSlot(slot, r) }
        }
        header("Все приложения · ${apps.size}")
        items(apps, key = { it.key }) { app ->
            AppCell(label = app.label, app = app, mono = s.monoIcons, onLong = { a.appInfo(app) }) { r -> a.launchApp(app, r) }
        }
    }
}

// ───────────────────────────── Функции ─────────────────────────────

@Composable
fun FunctionsPage(vm: LauncherVm) {
    val a = LocalActions.current
    val s by vm.prefs.settings.collectAsStateWithLifecycle()
    val apps by vm.apps.collectAsStateWithLifecycle()
    val access by vm.media.access.collectAsStateWithLifecycle()
    val bt = Slot.BT_MUSIC.resolve(apps, s.slots) as? LaunchTarget.App
    var showDiag by remember { mutableStateOf(false) }
    if (showDiag) MediaDiag(vm) { showDiag = false }
    var showCity by remember { mutableStateOf(false) }
    if (showCity) CityDialog(vm, s.city) { showCity = false }

    Column(Modifier.fillMaxSize().padding(horizontal = 6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        FuncRow {
            FuncBtn(Ic.Camera, "Передняя камера", null) { a.launchSlot(Slot.FRONT_CAM, it) }
            FuncBtn(Ic.Phone, "Телефон", null) { a.launchSlot(Slot.PHONE, it) }
            FuncBtn(Ic.Bluetooth, "Bluetooth", null) { a.openSystem(Settings.ACTION_BLUETOOTH_SETTINGS, false) }
            FuncBtn(Ic.Cloud, "Яндекс Диск", null) { a.launchSlot(Slot.DISK, it) }
            FuncBtn(Ic.Weather, "Город для погоды", s.city ?: "Авто (по интернету)", null) { showCity = true }
        }
        FuncRow {
            FuncBtn(Ic.Wifi, "Wi-Fi", null) { a.openSystem(Settings.ACTION_WIFI_SETTINGS, false) }
            FuncBtn(Ic.Headphones, "Bluetooth Music", if (bt != null) "Открыть" else "Удерживайте, чтобы выбрать", null, onLong = { a.pick(Slot.BT_MUSIC) }) {
                a.launchSlot(Slot.BT_MUSIC, it)
            }
            val modeText = when {
                !s.btOnStart -> "Выключено"
                s.btMode == "bg" -> "В фоне, без окна"
                s.btMode == "safe" -> "Надёжно (окно 2 с)"
                else -> "Быстро (окно мелькнёт)"
            }
            FuncBtn(Ic.Wave, "Bluetooth Music при включении", modeText, s.btOnStart) {
                // Быстро → В фоне → Надёжно → Выключено → Быстро
                vm.prefs.update {
                    when {
                        !s.btOnStart -> { putBoolean("btboot", true); putString("btmode", "fast") }
                        s.btMode == "fast" -> putString("btmode", "bg")
                        s.btMode == "bg" -> putString("btmode", "safe")
                        else -> putBoolean("btboot", false)
                    }
                }
            }
            FuncBtn(Ic.Music, "Диагностика", if (access) "Трек, уведомления, погода" else "Нажмите, чтобы разрешить доступ", access) {
                if (access) showDiag = true else a.openSystem("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS", false)
            }
        }
        FuncRow {
            FuncBtn(Ic.Palette, "Иконки в стиле Volvo", if (s.monoIcons) "Монохромные" else "Цветные", s.monoIcons) {
                vm.prefs.update { putBoolean("mono", !s.monoIcons) }
            }
            FuncBtn(Ic.Home, "Лаунчер по умолчанию", null) { a.openSystem(Settings.ACTION_HOME_SETTINGS, false) }
            FuncBtn(Ic.Gear, "Настройки Android", null) { a.openSystem(Settings.ACTION_SETTINGS, false) }
            FuncBtn(Ic.Headphones, "Музыка только с телефона", if (s.phoneOnly) "Только Bluetooth Music" else "Все плееры, и на магнитоле", s.phoneOnly) {
                vm.prefs.update { putBoolean("phoneonly", !s.phoneOnly) }
            }
            FuncBtn(Ic.Download, "Обновления", "Скачать новую версию", null) { a.openUrl(RELEASES_URL) }
        }
        Row(Modifier.fillMaxWidth().weight(1f), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            BrightnessCard(vm, Modifier.weight(1f).fillMaxHeight())
            ThemeCard(vm, Modifier.weight(1f).fillMaxHeight())
        }
        Spacer(Modifier.height(2.dp))
    }
}

@Composable
private fun FuncRow(content: @Composable RowScope.() -> Unit) {
    Row(Modifier.fillMaxWidth().height(78.dp), horizontalArrangement = Arrangement.spacedBy(6.dp), content = content)
}

/** Кнопка как «Функции автомобиля» в Sensus: слева полоска-индикатор включено/выключено. */
@Composable
private fun RowScope.FuncBtn(icon: ImageVector, title: String, active: Boolean?, onClick: (ARect?) -> Unit) =
    FuncBtn(icon, title, null, active, null, onClick)

@Composable
private fun RowScope.FuncBtn(
    icon: ImageVector,
    title: String,
    sub: String?,
    active: Boolean?,
    onLong: (() -> Unit)? = null,
    onClick: (ARect?) -> Unit,
) {
    val accent = LocalAccent.current
    val bar by animateColorAsState(if (active == true) accent.b else C.line, tween(260), label = "bar")
    Row(
        Modifier
            .weight(1f)
            .fillMaxHeight()
            .pressable(onLongClick = onLong, onClick = onClick)
            .tileBg()
            .padding(start = 14.dp, end = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (active != null) {
            Box(Modifier.size(3.dp, 34.dp).background(bar, RoundedCornerShape(2.dp)))
            Spacer(Modifier.width(14.dp))
        }
        VIcon(icon, C.txt, 26.dp)
        Spacer(Modifier.width(14.dp))
        Column {
            T(title, 15.sp, C.txt, FontWeight.Medium)
            if (sub != null) T(sub, 12.sp, C.dim)
        }
    }
}

@Composable
fun BrightnessCard(vm: LauncherVm, modifier: Modifier) {
    val a = LocalActions.current
    val b by vm.brightness.collectAsStateWithLifecycle()
    val can by vm.canWriteSettings.collectAsStateWithLifecycle()
    Column(modifier.background(C.tile, RoundedCornerShape(4.dp)).padding(horizontal = 18.dp, vertical = 14.dp)) {
        TileHeader(Ic.Sun, "Яркость экрана")
        Spacer(Modifier.weight(1f))
        LineSlider(
            value = b / 255f,
            onChange = { f ->
                if (!vm.setBrightness((f * 255).toInt())) a.openSystem(Settings.ACTION_MANAGE_WRITE_SETTINGS, true)
            },
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(4.dp))
        T(if (can) "${(b * 100 / 255)} %" else "Первое касание откроет разрешение на изменение яркости", 12.sp, C.dim)
    }
}

@Composable
fun ThemeCard(vm: LauncherVm, modifier: Modifier) {
    val s by vm.prefs.settings.collectAsStateWithLifecycle()
    Column(modifier.background(C.tile, RoundedCornerShape(4.dp)).padding(horizontal = 18.dp, vertical = 14.dp)) {
        TileHeader(Ic.Palette, "Тема — как на приборке")
        Spacer(Modifier.weight(1f))
        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Accent.entries.forEach { ac ->
                val selected = ac == s.accent
                Column(
                    Modifier
                        .width(118.dp)
                        .height(56.dp)
                        .pressable { vm.prefs.update { putString("accent", ac.name) } }
                        .background(C.tile2)
                        .border(1.5.dp, if (selected) ac.b else C.tile2, RoundedCornerShape(4.dp))
                        .padding(10.dp),
                    verticalArrangement = Arrangement.SpaceBetween,
                ) {
                    Box(Modifier.fillMaxWidth().height(4.dp).background(ac.brush, RoundedCornerShape(2.dp)))
                    T(ac.title, 13.sp, if (selected) C.txt else C.dim, FontWeight.Medium)
                }
            }
        }
    }
}

// ───────────────────────────── Выбор приложения для ярлыка ─────────────────────────────

@Composable
fun SlotPicker(slot: Slot, vm: LauncherVm, onDismiss: () -> Unit) {
    val apps by vm.apps.collectAsStateWithLifecycle()
    val s by vm.prefs.settings.collectAsStateWithLifecycle()
    val density = LocalDensity.current
    val current = (slot.resolve(apps, s.slots) as? LaunchTarget.App)?.let { "${it.pkg}/${it.cls}" }
    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        CompositionLocalProvider(LocalDensity provides density) {
            Column(
                Modifier
                    .size(1000.dp, 420.dp)
                    .background(C.tile2, RoundedCornerShape(6.dp))
                    .padding(16.dp)
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    VIcon(slot.icon, LocalAccent.current.b, 22.dp)
                    Spacer(Modifier.width(12.dp))
                    T("Что открывает «${slot.title}»", 18.sp, C.txt, FontWeight.SemiBold)
                    Spacer(Modifier.weight(1f))
                    SquareBtn(Ic.Close, size = 40) { onDismiss() }
                }
                Spacer(Modifier.height(12.dp))
                LazyVerticalGrid(
                    columns = GridCells.Fixed(8),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    item {
                        AppCell(label = "По умолчанию", vector = slot.icon, selected = s.slots[slot.name] == null) {
                            vm.prefs.update { remove("slot_" + slot.name) }
                            onDismiss()
                        }
                    }
                    items(apps, key = { it.key }) { app ->
                        AppCell(label = app.label, app = app, mono = s.monoIcons, selected = app.key == current) {
                            vm.prefs.update { putString("slot_" + slot.name, app.key) }
                            onDismiss()
                        }
                    }
                }
            }
        }
    }
}

// ───────────────────────────── Диагностика трека ─────────────────────────────

/** Что лаунчер видит о музыке: помогает понять, откуда брать трек на этой магнитоле. */
@Composable
fun MediaDiag(vm: LauncherVm, onDismiss: () -> Unit) {
    val text by vm.media.debug.collectAsStateWithLifecycle()
    val density = LocalDensity.current
    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        CompositionLocalProvider(LocalDensity provides density) {
            Column(
                Modifier
                    .size(900.dp, 400.dp)
                    .background(C.tile2, RoundedCornerShape(6.dp))
                    .padding(18.dp)
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    VIcon(Ic.Music, LocalAccent.current.b, 22.dp)
                    Spacer(Modifier.width(12.dp))
                    T("Диагностика — что видит лаунчер", 18.sp, C.txt, FontWeight.SemiBold)
                    Spacer(Modifier.weight(1f))
                    SquareBtn(Ic.Close, size = 40) { onDismiss() }
                }
                Spacer(Modifier.height(12.dp))
                Column(Modifier.weight(1f).verticalScroll(rememberScrollState())) {
                    T(text, 13.sp, C.txt, maxLines = 80)
                }
                T("Включите песню на телефоне, прокрутите вниз и сфотографируйте этот экран.", 12.sp, C.dim)
            }
        }
    }
}

// ───────────────────────────── Город для погоды ─────────────────────────────

private val QUICK_CITIES = listOf("Смоленск", "Москва", "Санкт-Петербург", "Минск", "Брянск", "Калуга")

@Composable
fun CityDialog(vm: LauncherVm, current: String?, onDismiss: () -> Unit) {
    val accent = LocalAccent.current
    val density = LocalDensity.current
    var text by remember { mutableStateOf(current.orEmpty()) }
    val focus = remember { androidx.compose.ui.focus.FocusRequester() }
    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        CompositionLocalProvider(LocalDensity provides density) {
            Column(
                Modifier
                    .size(760.dp, 300.dp)
                    .background(C.tile2, RoundedCornerShape(6.dp))
                    .padding(18.dp)
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    VIcon(Ic.Weather, accent.b, 22.dp)
                    Spacer(Modifier.width(12.dp))
                    T("Город для погоды", 18.sp, C.txt, FontWeight.SemiBold)
                    Spacer(Modifier.weight(1f))
                    SquareBtn(Ic.Close, size = 40) { onDismiss() }
                }
                Spacer(Modifier.height(14.dp))
                androidx.compose.foundation.text.BasicTextField(
                    value = text,
                    onValueChange = { text = it.take(40) },
                    singleLine = true,
                    textStyle = androidx.compose.ui.text.TextStyle(color = C.txt, fontSize = 20.sp, fontFamily = Inter),
                    cursorBrush = androidx.compose.ui.graphics.SolidColor(accent.b),
                    keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(imeAction = androidx.compose.ui.text.input.ImeAction.Done),
                    keyboardActions = androidx.compose.foundation.text.KeyboardActions(onDone = { vm.setCity(text); onDismiss() }),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(52.dp)
                        .background(C.tile, RoundedCornerShape(4.dp))
                        .border(1.5.dp, accent.b, RoundedCornerShape(4.dp))
                        .padding(horizontal = 14.dp, vertical = 13.dp)
                        .focusRequester(focus),
                    decorationBox = { inner ->
                        if (text.isEmpty()) T("Например, Смоленск", 20.sp, C.dim)
                        inner()
                    },
                )
                Spacer(Modifier.height(12.dp))
                Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    QUICK_CITIES.forEach { c ->
                        Box(
                            Modifier
                                .height(40.dp)
                                .pressable { text = c }
                                .tileBg()
                                .padding(horizontal = 14.dp),
                            contentAlignment = Alignment.Center,
                        ) { T(c, 14.sp, C.txt) }
                    }
                }
                Spacer(Modifier.weight(1f))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Box(
                        Modifier.weight(1f).height(50.dp).pressable { vm.setCity(null); onDismiss() }.tileBg(),
                        contentAlignment = Alignment.Center,
                    ) { T("Авто — по интернету", 15.sp, C.txt, FontWeight.Medium) }
                    Box(
                        Modifier.weight(1f).height(50.dp).pressable { vm.setCity(text); onDismiss() }.background(accent.brush, RoundedCornerShape(4.dp)),
                        contentAlignment = Alignment.Center,
                    ) { T("Сохранить", 15.sp, androidx.compose.ui.graphics.Color.White, FontWeight.SemiBold) }
                }
            }
        }
    }
    LaunchedEffect(Unit) { runCatching { focus.requestFocus() } }
}
