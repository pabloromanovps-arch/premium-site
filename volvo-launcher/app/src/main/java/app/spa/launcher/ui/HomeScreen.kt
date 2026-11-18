package app.spa.launcher.ui

import androidx.activity.compose.BackHandler
import androidx.compose.animation.Crossfade
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.PagerDefaults
import androidx.compose.foundation.pager.PagerState
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.spa.launcher.LauncherVm
import app.spa.launcher.data.LaunchTarget
import app.spa.launcher.data.MediaInfo
import app.spa.launcher.data.Slot
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.math.abs
import kotlin.math.min

const val PAGE_APPS = 0
const val PAGE_HOME = 1
const val PAGE_FUNCTIONS = 2

/**
 * Корень. Интерфейс нарисован под 1280×480 и масштабируется под реальный экран,
 * поэтому выглядит одинаково при любой плотности пикселей магнитолы.
 */
@Composable
fun LauncherRoot(vm: LauncherVm, homeSignal: Int, actions: UiActions, overlay: @Composable () -> Unit = {}) {
    BoxWithConstraints(Modifier.fillMaxSize().background(C.bg)) {
        val scale = min(maxWidth.value / 1280f, maxHeight.value / 480f)
        val base = LocalDensity.current
        CompositionLocalProvider(
            LocalDensity provides Density(base.density * scale, 1f),
            LocalActions provides actions,
        ) {
            Box(Modifier.size(1280.dp, 480.dp).align(Alignment.Center)) {
                Launcher(vm, homeSignal, overlay)
            }
        }
    }
}

@Composable
private fun Launcher(vm: LauncherVm, homeSignal: Int, overlay: @Composable () -> Unit) {
    val settings by vm.prefs.settings.collectAsStateWithLifecycle()
    val pager = rememberPagerState(initialPage = PAGE_HOME) { 3 }
    val scope = rememberCoroutineScope()
    val goTo: (Int) -> Unit = { p ->
        scope.launch { pager.animateScrollToPage(p, animationSpec = tween(420, easing = FastOutSlowInEasing)) }
    }
    LaunchedEffect(homeSignal) {
        if (homeSignal > 0) pager.animateScrollToPage(PAGE_HOME, animationSpec = tween(420, easing = FastOutSlowInEasing))
    }
    // «Назад» в лаунчере всегда возвращает на главный экран и никогда не закрывает его.
    BackHandler(enabled = true) { if (pager.currentPage != PAGE_HOME) goTo(PAGE_HOME) }

    CompositionLocalProvider(LocalAccent provides settings.accent) {
        Column(Modifier.fillMaxSize()) {
            StatusBar(vm, pager)
            HorizontalPager(
                state = pager,
                modifier = Modifier.fillMaxWidth().height(384.dp),
                beyondViewportPageCount = 1,
                flingBehavior = PagerDefaults.flingBehavior(
                    state = pager,
                    snapAnimationSpec = spring(dampingRatio = 0.86f, stiffness = 420f),
                ),
            ) { page ->
                Box(
                    Modifier
                        .fillMaxSize()
                        .graphicsLayer {
                            // Соседние экраны слегка уменьшаются и гаснут при свайпе, как в Sensus.
                            val o = abs((pager.currentPage - page) + pager.currentPageOffsetFraction).coerceIn(0f, 1f)
                            alpha = 1f - o * 0.55f
                            scaleX = 1f - o * 0.05f
                            scaleY = 1f - o * 0.05f
                        }
                ) {
                    when (page) {
                        PAGE_APPS -> AppsPage(vm)
                        PAGE_HOME -> HomePage(vm, goTo)
                        else -> FunctionsPage(vm)
                    }
                }
            }
            BottomBar(vm, pager, goTo)
        }
        overlay()
    }
}

// ───────────────────────────── Статус-строка ─────────────────────────────

private val timeFmt = SimpleDateFormat("HH:mm", Locale.getDefault())
private val dateFmt = SimpleDateFormat("EE, d MMMM", Locale("ru"))

private fun formatDate(ms: Long) = dateFmt.format(Date(ms)).replaceFirstChar { it.uppercase() }

@Composable
private fun StatusBar(vm: LauncherVm, pager: PagerState) {
    val now by vm.now.collectAsStateWithLifecycle()
    val media by vm.media.info.collectAsStateWithLifecycle()
    val weather by vm.weather.collectAsStateWithLifecycle()
    val gps by vm.location.gps.collectAsStateWithLifecycle()
    Box(Modifier.fillMaxWidth().height(34.dp).padding(horizontal = 18.dp)) {
        val m = media
        if (m != null && m.playing && m.title.isNotBlank()) {
            Row(Modifier.align(Alignment.CenterStart).widthIn(max = 420.dp), verticalAlignment = Alignment.CenterVertically) {
                VIcon(Ic.Music, C.dim, 14.dp)
                Spacer(Modifier.width(8.dp))
                T(listOf(m.title, m.artist).filter { it.isNotBlank() }.joinToString(" · "), 13.sp, C.dim)
            }
        }
        Column(Modifier.align(Alignment.Center), horizontalAlignment = Alignment.CenterHorizontally) {
            T(timeFmt.format(Date(now)), 15.sp, C.txt, FontWeight.Medium)
            Spacer(Modifier.height(4.dp))
            PageDots(pager)
        }
        Row(Modifier.align(Alignment.CenterEnd), verticalAlignment = Alignment.CenterVertically) {
            weather?.let { T(signed(it.temp) + "°C", 14.sp, C.dim) }
            Spacer(Modifier.width(14.dp))
            Box(Modifier.size(7.dp).background(if (gps?.fix == true) C.green else C.line, CircleShape))
            Spacer(Modifier.width(6.dp))
            T("GPS", 11.sp, C.dim, FontWeight.Medium)
        }
    }
}

private fun signed(t: Int) = if (t > 0) "+$t" else "$t"

@Composable
private fun PageDots(pager: PagerState) {
    val accent = LocalAccent.current
    Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        repeat(3) { i ->
            val pos = pager.currentPage + pager.currentPageOffsetFraction
            val k = (1f - abs(pos - i)).coerceIn(0f, 1f)
            Box(
                Modifier
                    .size(width = (5 + 13 * k).dp, height = 3.dp)
                    .background(lerp(C.line, accent.b, k), RoundedCornerShape(2.dp))
            )
        }
    }
}

// ───────────────────────────── Нижняя полоса ─────────────────────────────

@Composable
private fun BottomBar(vm: LauncherVm, pager: PagerState, goTo: (Int) -> Unit) {
    val accent = LocalAccent.current
    val now by vm.now.collectAsStateWithLifecycle()
    val weather by vm.weather.collectAsStateWithLifecycle()
    val vol by vm.volume.collectAsStateWithLifecycle()
    Box(Modifier.fillMaxWidth().height(62.dp).padding(horizontal = 22.dp)) {
        Row(Modifier.align(Alignment.CenterStart), verticalAlignment = Alignment.CenterVertically) {
            SquareBtn(Ic.Apps) { goTo(PAGE_APPS) }
            Spacer(Modifier.width(8.dp))
            SquareBtn(Ic.Sliders) { goTo(PAGE_FUNCTIONS) }
            Spacer(Modifier.width(16.dp))
            Column {
                T(formatDate(now), 15.sp, C.txt, FontWeight.Medium)
                val w = weather
                T(if (w != null) listOf(w.desc, signed(w.temp) + "°C").filter { it.isNotBlank() }.joinToString(" · ") else "Погода появится после GPS", 12.5.sp, C.dim)
            }
        }

        val onHome = pager.currentPage == PAGE_HOME && abs(pager.currentPageOffsetFraction) < 0.01f
        val pillW by animateDpAsState(if (onHome) 64.dp else 40.dp, spring(dampingRatio = 0.7f, stiffness = 500f), label = "pill")
        Box(
            Modifier
                .align(Alignment.Center)
                .size(150.dp, 46.dp)
                .pressable(RoundedCornerShape(23.dp), 0.92f) { goTo(PAGE_HOME) },
            contentAlignment = Alignment.Center,
        ) {
            Box(Modifier.size(pillW, 6.dp).background(accent.brush, RoundedCornerShape(3.dp)))
        }

        Row(Modifier.align(Alignment.CenterEnd), verticalAlignment = Alignment.CenterVertically) {
            SquareBtn(Ic.Minus) { vm.setVolume(vol.value - 1) }
            Spacer(Modifier.width(14.dp))
            VIcon(Ic.Volume, C.txt, 20.dp)
            Spacer(Modifier.width(10.dp))
            LineSlider(
                value = if (vol.max > 0) vol.value.toFloat() / vol.max else 0f,
                onChange = { f -> vm.setVolume(Math.round(f * vol.max)) },
                modifier = Modifier.width(150.dp),
            )
            T("${vol.value}", 14.sp, C.txt, modifier = Modifier.width(34.dp).padding(start = 10.dp))
            SquareBtn(Ic.Plus) { vm.setVolume(vol.value + 1) }
        }
    }
}

// ───────────────────────────── Главный экран ─────────────────────────────

@Composable
private fun HomePage(vm: LauncherVm, goTo: (Int) -> Unit) {
    Row(
        Modifier.fillMaxSize().padding(horizontal = 6.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        NavTile(vm, Modifier.width(520.dp).fillMaxHeight())
        MediaTile(vm, Modifier.weight(1f).fillMaxHeight())
        DriveTile(vm, Modifier.weight(1f).fillMaxHeight())
        SideColumn(goTo, Modifier.width(96.dp).fillMaxHeight())
    }
}

@Composable
private fun NavTile(vm: LauncherVm, modifier: Modifier) {
    val a = LocalActions.current
    val accent = LocalAccent.current
    val apps by vm.apps.collectAsStateWithLifecycle()
    val s by vm.prefs.settings.collectAsStateWithLifecycle()
    val gps by vm.location.gps.collectAsStateWithLifecycle()
    val target = remember(apps, s) { Slot.NAV.resolve(apps, s.slots) }
    Box(modifier.pressable(onLongClick = { a.pick(Slot.NAV) }) { a.launchSlot(Slot.NAV, it) }) {
        MapArt(accent, Modifier.fillMaxSize())
        Box(Modifier.fillMaxHeight().width(3.dp).background(accent.vbrush))
        Row(
            Modifier.padding(12.dp).background(C.chip, RoundedCornerShape(4.dp)).padding(horizontal = 14.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            VIcon(Ic.Nav, accent.b, 30.dp)
            Spacer(Modifier.width(12.dp))
            Column {
                T("Навигатор", 20.sp, C.txt, FontWeight.SemiBold)
                T((target as? LaunchTarget.App)?.label ?: "Удерживайте, чтобы выбрать", 13.sp, C.dim)
            }
        }
        Row(
            Modifier
                .align(Alignment.BottomCenter)
                .padding(12.dp)
                .fillMaxWidth()
                .background(C.chip, RoundedCornerShape(4.dp))
                .padding(horizontal = 14.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            T("Куда поедем?", 16.sp, C.txt, FontWeight.Medium)
            Spacer(Modifier.weight(1f))
            T("${gps?.speedKmh ?: 0} км/ч", 15.sp, C.dim)
        }
    }
}

/** Стилизованная карта. Рисуется один раз и кешируется — нагрузки нет. */
@Composable
private fun MapArt(accent: Accent, modifier: Modifier) {
    Canvas(modifier) {
        val sx = size.width / 520f
        val sy = size.height / 384f
        drawRect(Color(0xFF1A1D22))
        val block = Color(0xFF20242A)
        listOf(
            floatArrayOf(20f, 30f, 130f, 90f), floatArrayOf(190f, 20f, 110f, 140f), floatArrayOf(340f, 60f, 160f, 80f),
            floatArrayOf(30f, 170f, 100f, 120f), floatArrayOf(170f, 200f, 150f, 70f), floatArrayOf(360f, 180f, 140f, 150f),
            floatArrayOf(40f, 320f, 200f, 60f),
        ).forEach { r -> drawRoundRect(block, Offset(r[0] * sx, r[1] * sy), Size(r[2] * sx, r[3] * sy), CornerRadius(3 * sx)) }
        val road = Path().apply {
            moveTo(0f, 150 * sy)
            cubicTo(120 * sx, 140 * sy, 200 * sx, 175 * sy, 330 * sx, 165 * sy)
            cubicTo(420 * sx, 158 * sy, 470 * sx, 150 * sy, 520 * sx, 158 * sy)
        }
        drawPath(road, Color(0xFF2F343C), style = Stroke(16 * sx))
        val street = Color(0xFF2A2E35)
        drawLine(street, Offset(160 * sx, 0f), Offset(170 * sx, size.height), 9 * sx)
        drawLine(street, Offset(330 * sx, 0f), Offset(345 * sx, size.height), 9 * sx)
        drawLine(street, Offset(0f, 300 * sy), Offset(size.width, 290 * sy), 9 * sx)
        drawLine(Color(0xFF262A30), Offset(90 * sx, 0f), Offset(80 * sx, size.height), 5 * sx)
        val route = Path().apply {
            moveTo(258 * sx, 296 * sy)
            lineTo(340 * sx, 290 * sy)
            lineTo(337 * sx, 165 * sy)
            cubicTo(390 * sx, 160 * sy, 450 * sx, 152 * sy, 520 * sx, 158 * sy)
        }
        drawPath(route, accent.brush, style = Stroke(7 * sx, cap = StrokeCap.Round, join = StrokeJoin.Round))
        val c = Offset(258 * sx, 296 * sy)
        drawCircle(accent.a.copy(alpha = 0.28f), 17 * sx, c)
        val arrow = Path().apply {
            moveTo(c.x, c.y - 11 * sx); lineTo(c.x + 8 * sx, c.y + 9 * sx); lineTo(c.x, c.y + 5 * sx); lineTo(c.x - 8 * sx, c.y + 9 * sx); close()
        }
        drawPath(arrow, Color.White)
    }
}

@Composable
private fun MediaTile(vm: LauncherVm, modifier: Modifier) {
    val a = LocalActions.current
    val accent = LocalAccent.current
    val info by vm.media.info.collectAsStateWithLifecycle()
    val access by vm.media.access.collectAsStateWithLifecycle()
    val m = info
    Column(
        modifier
            .pressable(onLongClick = { a.pick(Slot.MUSIC) }) { r ->
                when {
                    !access -> a.openSystem("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS", false)
                    m != null -> a.launchPkg(m.pkg, r)
                    else -> a.launchSlot(Slot.MUSIC, r)
                }
            }
            .background(C.tile)
            .padding(horizontal = 18.dp, vertical = 14.dp)
    ) {
        TileHeader(Ic.Music, m?.appLabel ?: "Музыка")
        Spacer(Modifier.height(10.dp))
        Box(Modifier.fillMaxWidth().height(160.dp).clip(RoundedCornerShape(3.dp))) {
            Crossfade(targetState = m?.art, animationSpec = tween(450), label = "art") { art ->
                if (art != null) Image(art, null, Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
                else ArtPlaceholder(accent)
            }
        }
        Spacer(Modifier.height(12.dp))
        val (title, sub) = when {
            !access -> "Трек на главном экране" to "Нажмите и разрешите доступ к уведомлениям"
            m == null || m.title.isBlank() -> "Ничего не играет" to "Нажмите ▶, чтобы продолжить музыку"
            else -> m.title to m.artist
        }
        Crossfade(targetState = title to sub, animationSpec = tween(300), label = "title") { (t, s) ->
            Column {
                T(t, 19.sp, C.txt, FontWeight.SemiBold)
                Spacer(Modifier.height(3.dp))
                T(s, 14.sp, C.dim)
            }
        }
        Spacer(Modifier.height(12.dp))
        Progress(m)
        Spacer(Modifier.weight(1f))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceAround, verticalAlignment = Alignment.CenterVertically) {
            MediaBtn(Ic.Prev, 26) { vm.media.prev() }
            MediaBtn(if (m?.playing == true) Ic.Pause else Ic.Play, 34) { vm.media.playPause() }
            MediaBtn(Ic.Next, 26) { vm.media.next() }
        }
    }
}

@Composable
private fun ArtPlaceholder(accent: Accent) {
    Box(
        Modifier.fillMaxSize().drawBehind {
            drawRect(Brush.linearGradient(listOf(Color(0xFF221A2A), Color(0xFF0F1420))))
            drawCircle(
                Brush.radialGradient(listOf(Color(0xCCC44A2A), Color.Transparent), center = Offset(size.width * 0.3f, size.height * 0.4f), radius = size.height * 0.75f),
                radius = size.height * 0.75f, center = Offset(size.width * 0.3f, size.height * 0.4f),
            )
            drawCircle(
                Brush.radialGradient(listOf(accent.a.copy(alpha = 0.85f), Color.Transparent), center = Offset(size.width * 0.75f, size.height * 0.7f), radius = size.height * 0.8f),
                radius = size.height * 0.8f, center = Offset(size.width * 0.75f, size.height * 0.7f),
            )
        },
        contentAlignment = Alignment.Center,
    ) { VIcon(Ic.Music, Color.White.copy(alpha = 0.55f), 40.dp) }
}

@Composable
private fun Progress(m: MediaInfo?) {
    val accent = LocalAccent.current
    // Обновляем прогресс дважды в секунду и только пока играет музыка.
    val now by produceState(android.os.SystemClock.elapsedRealtime(), m) {
        value = android.os.SystemClock.elapsedRealtime()
        while (m?.playing == true) {
            delay(500)
            value = android.os.SystemClock.elapsedRealtime()
        }
    }
    val pos = m?.positionAt(now) ?: 0L
    val dur = m?.duration ?: 0L
    val frac = if (dur > 0) pos.toFloat() / dur else 0f
    val shown by animateFloatAsState(frac, tween(500), label = "progress")
    Box(
        Modifier.fillMaxWidth().height(3.dp).drawBehind {
            drawRoundRect(C.line, cornerRadius = CornerRadius(2f, 2f))
            drawRoundRect(accent.brush, size = Size(size.width * shown, size.height), cornerRadius = CornerRadius(2f, 2f))
        }
    )
    Spacer(Modifier.height(5.dp))
    Row(Modifier.fillMaxWidth()) {
        T(if (dur > 0) mmss(pos) else "", 11.sp, C.dim)
        Spacer(Modifier.weight(1f))
        T(if (dur > 0) mmss(dur) else "", 11.sp, C.dim)
    }
}

private fun mmss(ms: Long): String {
    val s = ms / 1000
    return "%d:%02d".format(s / 60, s % 60)
}

@Composable
private fun MediaBtn(icon: androidx.compose.ui.graphics.vector.ImageVector, size: Int, onClick: () -> Unit) {
    Box(
        Modifier.size(64.dp, 48.dp).pressable(RoundedCornerShape(24.dp), 0.86f) { onClick() },
        contentAlignment = Alignment.Center,
    ) { VIcon(icon, C.txt, size.dp) }
}

private val directions = listOf("С", "СВ", "В", "ЮВ", "Ю", "ЮЗ", "З", "СЗ")

@Composable
private fun DriveTile(vm: LauncherVm, modifier: Modifier) {
    val a = LocalActions.current
    val accent = LocalAccent.current
    val gps by vm.location.gps.collectAsStateWithLifecycle()
    val granted by vm.location.granted.collectAsStateWithLifecycle()
    val weather by vm.weather.collectAsStateWithLifecycle()
    val now by vm.now.collectAsStateWithLifecycle()
    val bearing = gps?.bearing

    // Плавный поворот стрелки компаса по кратчайшему пути (без оборота через 360°).
    var target by remember { mutableFloatStateOf(0f) }
    LaunchedEffect(bearing) {
        if (bearing != null) {
            var d = (bearing - target) % 360f
            if (d > 180f) d -= 360f
            if (d < -180f) d += 360f
            target += d
        }
    }
    val rot by animateFloatAsState(target, tween(700, easing = FastOutSlowInEasing), label = "compass")

    Column(
        modifier
            .pressable { r -> if (!granted) a.requestLocation() else a.launchSlot(Slot.NAV, r) }
            .background(C.tile)
            .padding(horizontal = 18.dp, vertical = 14.dp)
    ) {
        TileHeader(Ic.Nav, "Поездка")
        Spacer(Modifier.weight(1f))
        Row(verticalAlignment = Alignment.Bottom) {
            T("${gps?.speedKmh ?: 0}", 86.sp, C.txt, FontWeight.Light)
            T("км/ч", 16.sp, C.dim, modifier = Modifier.padding(start = 8.dp, bottom = 18.dp))
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            VIcon(Ic.Nav, if (bearing != null) accent.b else C.dim, 18.dp, Modifier.rotate(rot))
            Spacer(Modifier.width(8.dp))
            T(
                when {
                    !granted -> "Нажмите, чтобы разрешить GPS"
                    bearing != null -> "Курс " + directions[(((bearing + 22.5f) % 360f) / 45f).toInt().coerceIn(0, 7)]
                    gps?.fix == true -> "Стоим"
                    else -> "Поиск спутников…"
                },
                14.sp, C.dim,
            )
        }
        Spacer(Modifier.weight(1f))
        Box(Modifier.fillMaxWidth().height(1.dp).background(C.line))
        Spacer(Modifier.height(14.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            val w = weather
            T(if (w != null) signed(w.temp) + "°" else "—", 34.sp, C.txt, FontWeight.Light)
            Spacer(Modifier.width(14.dp))
            Column {
                T(w?.desc?.ifBlank { null } ?: "Погода", 14.sp, C.txt)
                T(formatDate(now), 12.5.sp, C.dim)
            }
        }
    }
}

@Composable
private fun SideColumn(goTo: (Int) -> Unit, modifier: Modifier) {
    val a = LocalActions.current
    Column(modifier, verticalArrangement = Arrangement.spacedBy(6.dp)) {
        SideBtn(Ic.Apps, "Приложения") { goTo(PAGE_APPS) }
        SideBtn(Ic.Camera, "Передняя камера", onLong = { a.pick(Slot.FRONT_CAM) }) { a.launchSlot(Slot.FRONT_CAM, it) }
        SideBtn(Ic.CarPlay, "CarPlay", onLong = { a.pick(Slot.CARPLAY) }) { a.launchSlot(Slot.CARPLAY, it) }
        SideBtn(Ic.YouTube, "YouTube", onLong = { a.pick(Slot.YOUTUBE) }) { a.launchSlot(Slot.YOUTUBE, it) }
    }
}

@Composable
private fun androidx.compose.foundation.layout.ColumnScope.SideBtn(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    onLong: (() -> Unit)? = null,
    onClick: (ARect?) -> Unit,
) {
    Column(
        Modifier
            .weight(1f)
            .fillMaxWidth()
            .pressable(onLongClick = onLong, onClick = onClick)
            .background(C.tile)
            .padding(horizontal = 4.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        VIcon(icon, C.txt, 24.dp)
        Spacer(Modifier.height(7.dp))
        T(label, 10.5.sp, C.dim, maxLines = 2, align = androidx.compose.ui.text.style.TextAlign.Center)
    }
}
