package app.spa.launcher.ui

import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.spa.launcher.data.AppEntry
import app.spa.launcher.data.Slot

typealias ARect = android.graphics.Rect

/** Действия, которые выполняет Activity (запуск приложений, системные экраны). */
class UiActions(
    val launchSlot: (Slot, ARect?) -> Unit,
    val launchApp: (AppEntry, ARect?) -> Unit,
    val launchPkg: (String, ARect?) -> Unit,
    val openSystem: (action: String, withPackageUri: Boolean) -> Unit,
    val openUrl: (String) -> Unit,
    val pick: (Slot) -> Unit,
    val appInfo: (AppEntry) -> Unit,
    val requestLocation: () -> Unit,
)

val LocalActions = staticCompositionLocalOf<UiActions> { error("UiActions not provided") }

/**
 * Нажатие как в Sensus: элемент чуть «вдавливается» и подсвечивается, без ряби.
 * Анимируются только масштаб и прозрачность — это рисует видеокарта, процессор не нагружается.
 */
@OptIn(ExperimentalFoundationApi::class)
fun Modifier.pressable(
    clipShape: Shape = RoundedCornerShape(4.dp),
    pressedScale: Float = 0.97f,
    onLongClick: (() -> Unit)? = null,
    onClick: (ARect?) -> Unit,
): Modifier = composed {
    val interaction = remember { MutableInteractionSource() }
    val pressed by interaction.collectIsPressedAsState()
    val scale by animateFloatAsState(
        targetValue = if (pressed) pressedScale else 1f,
        animationSpec = spring(dampingRatio = 0.65f, stiffness = Spring.StiffnessMedium),
        label = "press-scale",
    )
    val glow by animateFloatAsState(
        targetValue = if (pressed) 0.07f else 0f,
        animationSpec = tween(if (pressed) 60 else 260),
        label = "press-glow",
    )
    val bounds = remember { arrayOfNulls<ARect>(1) }
    this
        .onGloballyPositioned {
            val b = it.boundsInRoot()
            bounds[0] = ARect(b.left.toInt(), b.top.toInt(), b.right.toInt(), b.bottom.toInt())
        }
        .graphicsLayer {
            scaleX = scale
            scaleY = scale
            shape = clipShape
            clip = true
        }
        .drawWithContent {
            drawContent()
            if (glow > 0f) drawRect(Color.White.copy(alpha = glow))
        }
        .combinedClickable(
            interactionSource = interaction,
            indication = null,
            onLongClick = onLongClick,
            onClick = { onClick(bounds[0]) },
        )
}

/** Тонкий ползунок с градиентом темы. */
@Composable
fun LineSlider(value: Float, onChange: (Float) -> Unit, modifier: Modifier = Modifier) {
    val accent = LocalAccent.current
    val shown by animateFloatAsState(value.coerceIn(0f, 1f), tween(140), label = "slider")
    val cb by rememberUpdatedState(onChange)
    Box(
        modifier
            .height(36.dp)
            .pointerInput(Unit) {
                detectTapGestures { cb((it.x / size.width).coerceIn(0f, 1f)) }
            }
            .pointerInput(Unit) {
                detectHorizontalDragGestures { change, _ ->
                    change.consume()
                    cb((change.position.x / size.width).coerceIn(0f, 1f))
                }
            }
            .drawBehind {
                val h = 4.dp.toPx()
                val y = size.height / 2
                drawRoundRect(C.line, Offset(0f, y - h / 2), Size(size.width, h), CornerRadius(h / 2))
                drawRoundRect(accent.brush, Offset(0f, y - h / 2), Size(size.width * shown, h), CornerRadius(h / 2))
                drawCircle(Color.White, 7.dp.toPx(), Offset(size.width * shown, y))
            }
    )
}

/** Квадратная кнопка нижней полосы. */
@Composable
fun SquareBtn(icon: ImageVector, modifier: Modifier = Modifier, size: Int = 46, onClick: () -> Unit) {
    Box(
        modifier
            .size(size.dp)
            .pressable(pressedScale = 0.9f) { onClick() }
            .background(C.tile),
        contentAlignment = Alignment.Center,
    ) { VIcon(icon, C.txt, 22.dp) }
}

/** Заголовок плитки: маленькая иконка и серый текст. */
@Composable
fun TileHeader(icon: ImageVector, text: String) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        VIcon(icon, C.dim, 15.dp)
        Spacer(Modifier.width(8.dp))
        T(text, 13.sp, C.dim, FontWeight.Medium)
    }
}

/** Ячейка приложения: векторная иконка ярлыка или иконка самого приложения. */
@Composable
fun AppCell(
    label: String,
    vector: ImageVector? = null,
    app: AppEntry? = null,
    mono: Boolean = false,
    sub: String? = null,
    selected: Boolean = false,
    onLong: (() -> Unit)? = null,
    onClick: (ARect?) -> Unit,
) {
    val accent = LocalAccent.current
    Column(
        Modifier
            .fillMaxWidth()
            .height(104.dp)
            .pressable(onLongClick = onLong, onClick = onClick)
            .background(if (selected) C.tile2 else C.tile)
            .drawBehind {
                if (selected) drawRect(accent.brush, size = Size(size.width, 3.dp.toPx()))
            }
            .padding(horizontal = 8.dp, vertical = 10.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        when {
            vector != null -> VIcon(vector, if (sub != null) C.dim else C.txt, 32.dp)
            app != null -> androidx.compose.foundation.Image(
                bitmap = app.icon,
                contentDescription = null,
                modifier = Modifier.size(40.dp),
                colorFilter = if (mono) MonoFilter else null,
            )
        }
        Spacer(Modifier.height(9.dp))
        T(label, 12.5.sp, if (sub != null) C.dim else C.txt, maxLines = 2, align = TextAlign.Center)
        if (sub != null) T(sub, 10.5.sp, C.dim, align = TextAlign.Center)
    }
}
