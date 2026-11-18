package app.spa.launcher.ui

import android.graphics.Bitmap
import androidx.compose.animation.Crossfade
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.FilterQuality
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.spa.launcher.LauncherVm
import app.spa.launcher.data.LaunchTarget
import app.spa.launcher.data.Slot

/**
 * Полноэкранный плеер в духе приложения Media в Sensus:
 * крупная обложка, фон в её цветах, большие кнопки и ряд источников внизу.
 */
@Composable
fun NowPlaying(vm: LauncherVm, onClose: () -> Unit) {
    val a = LocalActions.current
    val accent = LocalAccent.current
    val info by vm.media.info.collectAsStateWithLifecycle()
    val access by vm.media.access.collectAsStateWithLifecycle()
    val apps by vm.apps.collectAsStateWithLifecycle()
    val s by vm.prefs.settings.collectAsStateWithLifecycle()
    val m = info
    val art = m?.art

    // «Размытый» фон: обложка, уменьшенная до 12×12 и растянутая обратно. Почти бесплатно для процессора.
    val ambient = remember(art) {
        art?.let { runCatching { Bitmap.createScaledBitmap(it.asAndroidBitmap(), 12, 12, true).asImageBitmap() }.getOrNull() }
    }

    Box(
        Modifier
            .fillMaxSize()
            .padding(horizontal = 6.dp)
            .clip(RoundedCornerShape(4.dp))
            .background(C.tile)
    ) {
        Crossfade(targetState = ambient, animationSpec = tween(600), label = "ambient") { amb ->
            if (amb != null) {
                Image(amb, null, Modifier.fillMaxSize(), contentScale = ContentScale.Crop, alpha = 0.7f, filterQuality = FilterQuality.Low)
            } else {
                Box(
                    Modifier.fillMaxSize().drawBehind {
                        drawCircle(
                            Brush.radialGradient(listOf(accent.a.copy(alpha = 0.45f), Color.Transparent)),
                            radius = size.height * 1.1f,
                            center = androidx.compose.ui.geometry.Offset(size.width * 0.18f, size.height * 0.5f),
                        )
                    }
                )
            }
        }
        Box(Modifier.fillMaxSize().background(Brush.horizontalGradient(listOf(Color(0x9905070C), Color(0xF005070C), Color(0xF805070C)))))

        Row(Modifier.fillMaxSize().padding(24.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(320.dp).clip(RoundedCornerShape(4.dp))) {
                Crossfade(targetState = art, animationSpec = tween(450), label = "np-art") { img ->
                    if (img != null) Image(img, null, Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
                    else ArtPlaceholder(accent)
                }
            }
            Spacer(Modifier.width(40.dp))
            Column(Modifier.weight(1f).fillMaxSize()) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    VIcon(Ic.Headphones, C.dim, 16.dp)
                    Spacer(Modifier.width(8.dp))
                    T(m?.appLabel ?: "Музыка", 14.sp, C.dim, FontWeight.Medium)
                    Spacer(Modifier.weight(1f))
                    SquareBtn(Ic.Close, size = 42) { onClose() }
                }
                Spacer(Modifier.height(14.dp))
                val title = m?.title?.ifBlank { null } ?: "Музыка с телефона"
                val sub = when {
                    m != null && m.title.isNotBlank() -> m.artist
                    !access -> "Разрешите «Трек на экране» в Функциях"
                    else -> "Включите песню на телефоне"
                }
                Crossfade(targetState = title to sub, animationSpec = tween(320), label = "np-title") { (t, st) ->
                    Column {
                        T(t, 30.sp, C.txt, FontWeight.SemiBold, maxLines = 2)
                        Spacer(Modifier.height(6.dp))
                        T(st, 19.sp, C.dim)
                    }
                }
                Spacer(Modifier.height(22.dp))
                Progress(m)
                Spacer(Modifier.height(12.dp))
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
                    MediaBtn(Ic.Prev, 32) { vm.media.prev() }
                    Spacer(Modifier.width(40.dp))
                    Box(
                        Modifier
                            .size(76.dp)
                            .pressable(CircleShape, 0.9f) { vm.media.playPause() }
                            .background(accent.brush, CircleShape),
                        contentAlignment = Alignment.Center,
                    ) { VIcon(if (m?.playing == true) Ic.Pause else Ic.Play, Color.White, 34.dp) }
                    Spacer(Modifier.width(40.dp))
                    MediaBtn(Ic.Next, 32) { vm.media.next() }
                }
                Spacer(Modifier.weight(1f))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf(
                        Triple(Slot.BT_MUSIC, "Открыть Bluetooth Music", Ic.Bluetooth),
                    ).forEach { (slot, label, icon) ->
                        val pkg = (slot.resolve(apps, s.slots) as? LaunchTarget.App)?.pkg
                        SourceChip(icon, label, selected = pkg != null && pkg == m?.pkg, available = pkg != null) {
                            a.launchSlot(slot, it)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SourceChip(icon: ImageVector, label: String, selected: Boolean, available: Boolean, onClick: (ARect?) -> Unit) {
    val accent = LocalAccent.current
    Row(
        Modifier
            .height(46.dp)
            .pressable(onClick = onClick)
            .background(if (selected) C.tile2 else Color(0x99111622))
            .border(1.5.dp, if (selected) accent.b else Color.Transparent, RoundedCornerShape(4.dp))
            .padding(horizontal = 16.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        VIcon(icon, if (available) C.txt else C.dim, 18.dp)
        Spacer(Modifier.width(10.dp))
        T(label, 14.sp, if (available) C.txt else C.dim, FontWeight.Medium)
    }
}
