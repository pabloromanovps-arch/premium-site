package app.spa.launcher.ui

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.MutableTransitionState
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.detectVerticalDragGestures
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.animation.Crossfade
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
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
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.PagerDefaults
import androidx.compose.foundation.pager.PagerState
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
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
import java.util.TimeZone
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
    var nowPlaying by remember { mutableStateOf(false) }
    var panel by remember { mutableStateOf(false) }
    val welcome = remember { MutableTransitionState(WelcomeGate.take()) }
    LaunchedEffect(Unit) {
        if (welcome.currentState) {
            delay(2600)
            welcome.targetState = false
        }
    }
    val goTo: (Int) -> Unit = { p ->
        nowPlaying = false
        scope.launch { pager.animateScrollToPage(p, animationSpec = tween(420, easing = FastOutSlowInEasing)) }
    }
    LaunchedEffect(homeSignal) {
        if (homeSignal > 0) {
            nowPlaying = false
            panel = false
            pager.animateScrollToPage(PAGE_HOME, animationSpec = tween(420, easing = FastOutSlowInEasing))
        }
    }
    // «Назад» в лаунчере закрывает шторку/плеер или возвращает на главный экран, но никогда не закрывает лаунчер.
    BackHandler(enabled = true) {
        when {
            panel -> panel = false
            nowPlaying -> nowPlaying = false
            pager.currentPage != PAGE_HOME -> goTo(PAGE_HOME)
        }
    }

    CompositionLocalProvider(LocalAccent provides settings.accent) {
        Column(Modifier.fillMaxSize()) {
            StatusBar(vm, pager) { panel = true }
            Box(Modifier.fillMaxWidth().height(384.dp)) {
                HorizontalPager(
                    state = pager,
                    modifier = Modifier.fillMaxSize(),
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
                            PAGE_HOME -> HomePage(vm, goTo) { nowPlaying = true }
                            else -> FunctionsPage(vm)
                        }
                    }
                }
                // Плеер раскрывается из карточки музыки, как плитки в Sensus.
                AnimatedVisibility(
                    visible = nowPlaying,
                    enter = fadeIn(tween(200)) + scaleIn(tween(340, easing = FastOutSlowInEasing), initialScale = 0.86f, transformOrigin = TransformOrigin(0.16f, 0.5f)),
                    exit = fadeOut(tween(200)) + scaleOut(tween(260, easing = FastOutSlowInEasing), targetScale = 0.9f, transformOrigin = TransformOrigin(0.16f, 0.5f)),
                ) { NowPlaying(vm) { nowPlaying = false } }
            }
            BottomBar(vm, pager) { p -> if (p == PAGE_HOME && nowPlaying) nowPlaying = false else goTo(p) }
        }

        // Шторка сверху.
        AnimatedVisibility(visible = panel, enter = fadeIn(tween(220)), exit = fadeOut(tween(220))) {
            Box(
                Modifier
                    .fillMaxSize()
                    .background(Color(0x99000000))
                    .pressable(clipShape = RectangleShape, pressedScale = 1f) { panel = false }
            )
        }
        AnimatedVisibility(
            visible = panel,
            enter = slideInVertically(tween(320, easing = FastOutSlowInEasing)) { -it } + fadeIn(tween(200)),
            exit = slideOutVertically(tween(260, easing = FastOutSlowInEasing)) { -it } + fadeOut(tween(200)),
        ) { TopPanel(vm, onClose = { panel = false }, openFunctions = { goTo(PAGE_FUNCTIONS) }) }

        overlay()

        AnimatedVisibility(visibleState = welcome, enter = fadeIn(tween(1)), exit = fadeOut(tween(700))) { Welcome(vm) }
    }
}

/** Приветствие показываем один раз, только сразу после включения магнитолы. */
object WelcomeGate {
    private var shown = false
    fun take(): Boolean {
        if (shown) return false
        shown = true
        return android.os.SystemClock.elapsedRealtime() < 4 * 60_000L
    }
}

// ───────────────────────────── Время и дата ─────────────────────────────

private val ru = Locale("ru")

fun formatTime(ms: Long, tz: TimeZone): String =
    SimpleDateFormat("HH:mm", ru).apply { timeZone = tz }.format(Date(ms))

fun formatDate(ms: Long, tz: TimeZone): String =
    SimpleDateFormat("EEEE, d MMMM", ru).apply { timeZone = tz }.format(Date(ms)).replaceFirstChar { it.uppercase() }

fun signed(t: Int) = if (t > 0) "+$t" else "$t"

// ───────────────────────────── Статус-строка ─────────────────────────────

@Composable
private fun StatusBar(vm: LauncherVm, pager: PagerState, onPull: () -> Unit) {
    val now by vm.now.collectAsStateWithLifecycle()
    val tz by vm.zone.collectAsStateWithLifecycle()
    val media by vm.media.info.collectAsStateWithLifecycle()
    val weather by vm.weather.collectAsStateWithLifecycle()
    val pull by rememberUpdatedState(onPull)
    Box(
        Modifier
            .fillMaxWidth()
            .height(34.dp)
            .pointerInput(Unit) {
                detectVerticalDragGestures { change, dy ->
                    if (dy > 6) {
                        change.consume()
                        pull()
                    }
                }
            }
            .pointerInput(Unit) { detectTapGestures { pull() } }
            .padding(horizontal = 18.dp)
    ) {
        val m = media
        if (m != null && m.playing && m.title.isNotBlank()) {
            Row(Modifier.align(Alignment.CenterStart).widthIn(max = 420.dp), verticalAlignment = Alignment.CenterVertically) {
                VIcon(Ic.Music, C.dim, 14.dp)
                Spacer(Modifier.width(8.dp))
                T(listOf(m.title, m.artist).filter { it.isNotBlank() }.joinToString(" · "), 13.sp, C.dim)
            }
        }
        Column(Modifier.align(Alignment.Center), horizontalAlignment = Alignment.CenterHorizontally) {
            T(formatTime(now, tz), 15.sp, C.txt, FontWeight.Medium)
            Spacer(Modifier.height(4.dp))
            PageDots(pager)
        }
        weather?.let { w ->
            T(listOf(w.city, signed(w.temp) + "°C").filter { it.isNotBlank() }.joinToString("  "), 14.sp, C.dim, modifier = Modifier.align(Alignment.CenterEnd))
        }
    }
}

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

/** Как климатическая полоса Sensus: слева кнопки и дата, по центру «Домой», справа температура снаружи. */
@Composable
private fun BottomBar(vm: LauncherVm, pager: PagerState, goTo: (Int) -> Unit) {
    val accent = LocalAccent.current
    val now by vm.now.collectAsStateWithLifecycle()
    val tz by vm.zone.collectAsStateWithLifecycle()
    val weather by vm.weather.collectAsStateWithLifecycle()
    Box(Modifier.fillMaxWidth().height(62.dp).padding(horizontal = 22.dp)) {
        Row(Modifier.align(Alignment.CenterStart), verticalAlignment = Alignment.CenterVertically) {
            SquareBtn(Ic.Apps) { goTo(PAGE_APPS) }
            Spacer(Modifier.width(8.dp))
            SquareBtn(Ic.Sliders) { goTo(PAGE_FUNCTIONS) }
            Spacer(Modifier.width(18.dp))
            T(formatDate(now, tz), 16.sp, C.txt, FontWeight.Medium)
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

        val w = weather
        if (w != null) {
            Row(Modifier.align(Alignment.CenterEnd), verticalAlignment = Alignment.CenterVertically) {
                T(w.desc, 13.sp, C.dim, modifier = Modifier.padding(end = 14.dp))
                T(signed(w.temp), 32.sp, C.txt, FontWeight.Light)
                T("°C", 13.sp, C.txt, modifier = Modifier.padding(start = 2.dp, bottom = 12.dp))
            }
        }
    }
}

// ───────────────────────────── Главный экран ─────────────────────────────

@Composable
private fun HomePage(vm: LauncherVm, goTo: (Int) -> Unit, openPlayer: () -> Unit) {
    val a = LocalActions.current
    val apps by vm.apps.collectAsStateWithLifecycle()
    val s by vm.prefs.settings.collectAsStateWithLifecycle()
    fun sub(slot: Slot): String? = when (val t = slot.resolve(apps, s.slots)) {
        null -> "Удерживайте, чтобы выбрать"
        is LaunchTarget.App -> t.label.takeIf { !it.equals(slot.title, ignoreCase = true) }
        else -> null
    }

    Row(Modifier.fillMaxSize().padding(horizontal = 6.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        MediaCard(vm, Modifier.width(400.dp).fillMaxHeight(), openPlayer)
        Column(Modifier.weight(1f).fillMaxHeight(), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(Modifier.weight(1f).fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                SlotTile(Slot.NAV, Ic.Nav, sub(Slot.NAV))
                SlotTile(Slot.CARPLAY, Ic.CarPlay, sub(Slot.CARPLAY))
                SlotTile(Slot.YOUTUBE, Ic.YouTube, sub(Slot.YOUTUBE))
                SlotTile(Slot.FRONT_CAM, Ic.Camera, sub(Slot.FRONT_CAM))
            }
            Row(Modifier.weight(1f).fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                SlotTile(Slot.AUX, Ic.Aux, sub(Slot.AUX))
                WeatherTile(vm, Modifier.weight(2f).fillMaxHeight()) { a.openUrl("https://yandex.ru/pogoda") }
                BigTile(Ic.Apps, "Приложения", "${apps.size} установлено", Modifier.weight(1f).fillMaxHeight()) { goTo(PAGE_APPS) }
            }
        }
    }
}

@Composable
private fun RowScope.SlotTile(slot: Slot, icon: ImageVector, sub: String?) {
    val a = LocalActions.current
    BigTile(icon, slot.title, sub, Modifier.weight(1f).fillMaxHeight(), onLong = { a.pick(slot) }) { a.launchSlot(slot, it) }
}

/** Крупная плитка с иконкой в мягком свечении цвета темы. */
@Composable
fun BigTile(
    icon: ImageVector,
    title: String,
    sub: String?,
    modifier: Modifier,
    onLong: (() -> Unit)? = null,
    onClick: (ARect?) -> Unit,
) {
    val accent = LocalAccent.current
    Column(
        modifier
            .pressable(onLongClick = onLong, onClick = onClick)
            .background(Brush.verticalGradient(listOf(C.tile2, C.tile)))
            .drawBehind { drawRect(Color.White.copy(alpha = 0.05f), size = Size(size.width, 1.dp.toPx())) }
            .padding(horizontal = 10.dp, vertical = 12.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Box(
            Modifier.size(86.dp).drawBehind {
                drawCircle(
                    Brush.radialGradient(listOf(accent.a.copy(alpha = 0.38f), Color.Transparent)),
                    radius = size.minDimension / 2,
                )
            },
            contentAlignment = Alignment.Center,
        ) { VIcon(icon, C.txt, 46.dp) }
        Spacer(Modifier.height(8.dp))
        T(title, 16.sp, C.txt, FontWeight.Medium, align = TextAlign.Center)
        if (sub != null) {
            Spacer(Modifier.height(2.dp))
            T(sub, 11.5.sp, C.dim, align = TextAlign.Center)
        }
    }
}

@Composable
private fun WeatherTile(vm: LauncherVm, modifier: Modifier, onClick: () -> Unit) {
    val accent = LocalAccent.current
    val weather by vm.weather.collectAsStateWithLifecycle()
    val now by vm.now.collectAsStateWithLifecycle()
    val tz by vm.zone.collectAsStateWithLifecycle()
    Row(
        modifier
            .pressable { onClick() }
            .background(Brush.verticalGradient(listOf(C.tile2, C.tile)))
            .padding(horizontal = 24.dp, vertical = 18.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        val w = weather
        Column(Modifier.weight(1f)) {
            T(w?.city?.ifBlank { null } ?: "Погода", 14.sp, C.dim, FontWeight.Medium)
            Row(verticalAlignment = Alignment.Top) {
                T(if (w != null) signed(w.temp) else "—", 64.sp, C.txt, FontWeight.Light)
                T("°C", 18.sp, C.txt, modifier = Modifier.padding(top = 12.dp, start = 2.dp))
            }
            T(w?.desc?.ifBlank { null } ?: if (w == null) "Подключаемся к интернету…" else "", 15.sp, C.txt)
            Spacer(Modifier.height(3.dp))
            T(
                if (w != null) "Ощущается ${signed(w.feels)}° · ветер ${w.wind} м/с" else formatDate(now, tz),
                12.5.sp, C.dim,
            )
        }
        Box(
            Modifier.size(110.dp).drawBehind {
                drawCircle(Brush.radialGradient(listOf(accent.a.copy(alpha = 0.4f), Color.Transparent)), radius = size.minDimension / 2)
            },
            contentAlignment = Alignment.Center,
        ) { VIcon(Ic.Weather, C.txt, 62.dp) }
    }
}

// ───────────────────────────── Музыка ─────────────────────────────

@Composable
private fun MediaCard(vm: LauncherVm, modifier: Modifier, openPlayer: () -> Unit) {
    val a = LocalActions.current
    val accent = LocalAccent.current
    val info by vm.media.info.collectAsStateWithLifecycle()
    val access by vm.media.access.collectAsStateWithLifecycle()
    val m = info
    Column(
        modifier
            .pressable(onLongClick = { a.pick(Slot.BT_MUSIC) }) { openPlayer() }
            .background(Brush.verticalGradient(listOf(C.tile2, C.tile)))
            .padding(horizontal = 18.dp, vertical = 14.dp)
    ) {
        TileHeader(Ic.Headphones, m?.appLabel ?: "Музыка Bluetooth")
        Spacer(Modifier.height(10.dp))
        Box(Modifier.fillMaxWidth().height(158.dp).clip(RoundedCornerShape(3.dp))) {
            Crossfade(targetState = m?.art, animationSpec = tween(450), label = "art") { art ->
                if (art != null) Image(art, null, Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
                else ArtPlaceholder(accent)
            }
        }
        Spacer(Modifier.height(12.dp))
        val (title, sub) = when {
            m != null && m.title.isNotBlank() -> m.title to m.artist
            !access -> "Музыка с телефона" to "Включите «Трек на экране» в Функциях"
            else -> "Музыка с телефона" to "Нажмите, чтобы открыть Bluetooth Music"
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
fun ArtPlaceholder(accent: Accent) {
    Box(
        Modifier.fillMaxSize().drawBehind {
            drawRect(Brush.linearGradient(listOf(Color(0xFF1B1830), Color(0xFF0C1220))))
            val c1 = Offset(size.width * 0.28f, size.height * 0.35f)
            drawCircle(Brush.radialGradient(listOf(accent.b.copy(alpha = 0.55f), Color.Transparent), center = c1, radius = size.height * 0.8f), radius = size.height * 0.8f, center = c1)
            val c2 = Offset(size.width * 0.78f, size.height * 0.75f)
            drawCircle(Brush.radialGradient(listOf(accent.a.copy(alpha = 0.85f), Color.Transparent), center = c2, radius = size.height * 0.9f), radius = size.height * 0.9f, center = c2)
        },
        contentAlignment = Alignment.Center,
    ) { VIcon(Ic.Headphones, Color.White.copy(alpha = 0.6f), 44.dp) }
}

@Composable
fun Progress(m: MediaInfo?) {
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
fun MediaBtn(icon: ImageVector, size: Int, onClick: () -> Unit) {
    Box(
        Modifier.size(64.dp, 48.dp).pressable(RoundedCornerShape(24.dp), 0.86f) { onClick() },
        contentAlignment = Alignment.Center,
    ) { VIcon(icon, C.txt, size.dp) }
}
