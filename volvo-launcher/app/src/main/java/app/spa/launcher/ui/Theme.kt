package app.spa.launcher.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.ColorMatrix
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import app.spa.launcher.R

/** Темы как у цифровой приборки Volvo P3 (2014): Elegance / Eco / Performance. */
enum class Accent(
    val title: String,
    val a: Color,
    val b: Color,
    /** R-Design: графитовые плитки с фактурой карбона и хромированной кромкой. */
    val carbon: Boolean = false,
    val top: Color = Color(0xFF19202E),
    val bottom: Color = Color(0xFF111622),
) {
    ELEGANCE("Elegance", Color(0xFF1F4FD8), Color(0xFF6FB2FF)),
    ECO("Eco", Color(0xFF0B8A6A), Color(0xFF6FE0B8)),
    PERFORMANCE("Performance", Color(0xFFB3122B), Color(0xFFFF6A55)),
    RDESIGN("R-Design", Color(0xFF0057D9), Color(0xFF4FC3FF), carbon = true, top = Color(0xFF1D2025), bottom = Color(0xFF0C0D10));

    val brush: Brush get() = Brush.horizontalGradient(listOf(a, b))
    val vbrush: Brush get() = Brush.verticalGradient(listOf(b, a))
}

object C {
    // Тёмно-синие тона, как у экрана Sensus.
    val bg = Color(0xFF05070C)
    val tile = Color(0xFF111622)
    val tile2 = Color(0xFF19202E)
    val chip = Color(0xE60A0D14)
    val line = Color(0xFF263042)
    val txt = Color(0xFFE9EEF5)
    val dim = Color(0xFF8A94A6)
    val green = Color(0xFF3DDC84)
    val red = Color(0xFFE5332A)
}

val Inter = FontFamily(
    Font(R.font.inter_light, FontWeight.Light),
    Font(R.font.inter_regular, FontWeight.Normal),
    Font(R.font.inter_medium, FontWeight.Medium),
    Font(R.font.inter_semibold, FontWeight.SemiBold),
)

val LocalAccent = staticCompositionLocalOf { Accent.ELEGANCE }

val MonoFilter = ColorFilter.colorMatrix(ColorMatrix().apply { setToSaturation(0f) })

@Composable
fun T(
    text: String,
    size: TextUnit,
    color: Color = C.txt,
    weight: FontWeight = FontWeight.Normal,
    modifier: Modifier = Modifier,
    maxLines: Int = 1,
    align: TextAlign = TextAlign.Start,
) {
    BasicText(
        text = text,
        modifier = modifier,
        style = TextStyle(color = color, fontSize = size, fontFamily = Inter, fontWeight = weight, textAlign = align),
        maxLines = maxLines,
        overflow = TextOverflow.Ellipsis,
    )
}

@Composable
fun VIcon(v: ImageVector, tint: Color = C.txt, size: Dp = 24.dp, modifier: Modifier = Modifier) {
    Image(imageVector = v, contentDescription = null, modifier = modifier.size(size), colorFilter = ColorFilter.tint(tint))
}
