package app.spa.launcher.ui

import android.provider.Settings
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectVerticalDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.spa.launcher.LauncherVm
import java.util.Calendar
import java.util.TimeZone

// ───────────────────────────── Шторка сверху ─────────────────────────────

/** Верхняя панель как в Sensus: часы, погода, быстрые кнопки, яркость и тема. */
@Composable
fun TopPanel(vm: LauncherVm, onClose: () -> Unit, openFunctions: () -> Unit) {
    val a = LocalActions.current
    val now by vm.now.collectAsStateWithLifecycle()
    val tz by vm.zone.collectAsStateWithLifecycle()
    val weather by vm.weather.collectAsStateWithLifecycle()
    val close by rememberUpdatedState(onClose)
    Column(
        Modifier
            .fillMaxWidth()
            .height(330.dp)
            .background(C.tile2, RoundedCornerShape(bottomStart = 8.dp, bottomEnd = 8.dp))
            .pointerInput(Unit) {
                detectVerticalDragGestures { change, dy ->
                    if (dy < -8) {
                        change.consume()
                        close()
                    }
                }
            }
            .padding(horizontal = 24.dp, vertical = 16.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            T(formatTime(now, tz), 52.sp, C.txt, FontWeight.Light)
            Spacer(Modifier.width(22.dp))
            Column {
                T(formatDate(now, tz), 17.sp, C.txt, FontWeight.Medium)
                val w = weather
                T(
                    if (w != null) listOf(w.city, signed(w.temp) + "°C", w.desc).filter { it.isNotBlank() }.joinToString(" · ")
                    else "Погода появится, когда будет интернет",
                    14.sp, C.dim,
                )
            }
            Spacer(Modifier.weight(1f))
            SquareBtn(Ic.Close, size = 44) { onClose() }
        }
        Spacer(Modifier.height(16.dp))
        Row(Modifier.fillMaxWidth().height(70.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            QuickBtn(Ic.Wifi, "Wi-Fi") { a.openSystem(Settings.ACTION_WIFI_SETTINGS, false) }
            QuickBtn(Ic.Bluetooth, "Bluetooth") { a.openSystem(Settings.ACTION_BLUETOOTH_SETTINGS, false) }
            QuickBtn(Ic.Sliders, "Функции") { onClose(); openFunctions() }
            QuickBtn(Ic.Gear, "Настройки") { a.openSystem(Settings.ACTION_SETTINGS, false) }
        }
        Spacer(Modifier.height(6.dp))
        Row(Modifier.fillMaxWidth().weight(1f), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            BrightnessCard(vm, Modifier.weight(1f).fillMaxHeight())
            ThemeCard(vm, Modifier.weight(1f).fillMaxHeight())
        }
        Spacer(Modifier.height(8.dp))
        Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
            Box(Modifier.size(48.dp, 4.dp).background(C.line, RoundedCornerShape(2.dp)))
        }
    }
}

@Composable
private fun RowScope.QuickBtn(icon: ImageVector, label: String, onClick: () -> Unit) {
    Row(
        Modifier
            .weight(1f)
            .fillMaxHeight()
            .pressable { onClick() }
            .background(C.tile)
            .padding(horizontal = 18.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        VIcon(icon, C.txt, 24.dp)
        Spacer(Modifier.width(14.dp))
        T(label, 15.sp, C.txt, FontWeight.Medium)
    }
}

// ───────────────────────────── Приветствие при включении ─────────────────────────────

fun greeting(ms: Long, tz: TimeZone): String {
    val h = Calendar.getInstance(tz).apply { timeInMillis = ms }.get(Calendar.HOUR_OF_DAY)
    return when (h) {
        in 5..11 -> "Доброе утро"
        in 12..17 -> "Добрый день"
        in 18..22 -> "Добрый вечер"
        else -> "Доброй ночи"
    }
}

/** Короткая заставка после включения магнитолы, как приветствие водителя у Volvo. */
@Composable
fun Welcome(vm: LauncherVm) {
    val accent = LocalAccent.current
    val now by vm.now.collectAsStateWithLifecycle()
    val tz by vm.zone.collectAsStateWithLifecycle()
    val weather by vm.weather.collectAsStateWithLifecycle()
    var grow by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { grow = true }
    val lineW by animateDpAsState(if (grow) 260.dp else 0.dp, tween(1400, easing = FastOutSlowInEasing), label = "welcome-line")
    Box(Modifier.fillMaxSize().background(C.bg), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            T(greeting(now, tz), 40.sp, C.txt, FontWeight.Light, align = TextAlign.Center)
            Spacer(Modifier.height(18.dp))
            Box(Modifier.size(lineW, 3.dp).background(accent.brush, RoundedCornerShape(2.dp)))
            Spacer(Modifier.height(18.dp))
            val w = weather
            T(
                listOfNotNull(formatDate(now, tz), w?.let { listOf(it.city, signed(it.temp) + "°C").filter { x -> x.isNotBlank() }.joinToString(" · ") })
                    .joinToString("   "),
                16.sp, C.dim, align = TextAlign.Center,
            )
        }
    }
}
