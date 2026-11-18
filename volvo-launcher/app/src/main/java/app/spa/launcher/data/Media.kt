package app.spa.launcher.data

import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.Bitmap
import android.media.AudioManager
import android.media.MediaMetadata
import android.media.session.MediaController
import android.media.session.MediaSessionManager
import android.media.session.PlaybackState
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.view.KeyEvent
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import app.spa.launcher.MediaListenerService
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

data class MediaInfo(
    val pkg: String,
    val appLabel: String,
    val title: String,
    val artist: String,
    val art: ImageBitmap?,
    val duration: Long,
    val position: Long,
    val updateTime: Long,
    val speed: Float,
    val playing: Boolean,
) {
    fun positionAt(now: Long): Long {
        val p = if (playing) position + ((now - updateTime) * speed).toLong() else position
        return if (duration > 0) p.coerceIn(0, duration) else p.coerceAtLeast(0)
    }
}

/** Трек, полученный не через сессию плеера, а из уведомления или системной рассылки. */
data class AltTrack(
    val source: String,
    val pkg: String?,
    val title: String,
    val artist: String,
    val duration: Long = 0,
    val position: Long = -1,
    val playing: Boolean? = null,
    val time: Long = SystemClock.elapsedRealtime(),
)

/** Связь с сервисом уведомлений: он живёт в том же процессе. */
object MediaBus {
    @Volatile var musicPkgs: Set<String> = emptySet()

    /** Последние уведомления любых приложений — для диагностики (звонки, Bluetooth Music). */
    @Volatile var recent: List<String> = emptyList()
        private set

    fun record(line: String) {
        recent = (listOf(line) + recent.filter { it != line }).take(10)
    }
    var onNotification: ((AltTrack?) -> Unit)? = null
    var lastNotification: AltTrack? = null
        private set

    fun post(t: AltTrack?) {
        lastNotification = t
        onNotification?.invoke(t)
    }
}

/**
 * Текущий трек из любого источника, по порядку:
 * 1) сессия плеера (Яндекс Музыка, VK, CarPlay, системный Bluetooth);
 * 2) системная рассылка о смене трека (так делают многие Bluetooth-приложения магнитол);
 * 3) уведомление приложения Bluetooth Music.
 * Если обложки нет, ищем её в интернете по исполнителю и названию.
 */
class MediaRepo(private val ctx: Context, private val scope: CoroutineScope) {
    private val msm = ctx.getSystemService(MediaSessionManager::class.java)
    private val am = ctx.getSystemService(AudioManager::class.java)
    private val comp = ComponentName(ctx, MediaListenerService::class.java)
    private val handler = Handler(Looper.getMainLooper())

    val info = MutableStateFlow<MediaInfo?>(null)
    val access = MutableStateFlow(false)
    val debug = MutableStateFlow("Нет данных")

    /** Что делать, если ничего не играет и нажали ▶: запустить Bluetooth Music. */
    var onNothingToPlay: (() -> Unit)? = null

    /** Только музыка с телефона: Bluetooth Music, системный Bluetooth и CarPlay (TLink). */
    @Volatile var phoneOnly: Boolean = true
    @Volatile var phonePkgs: Set<String> = emptySet()

    private fun isPhone(pkg: String) = pkg in phonePkgs || pkg.contains("bluetooth", ignoreCase = true)

    /** Пакет Bluetooth Music: его открываем по нажатию, если трек пришёл не из сессии. */
    @Volatile var fallbackPkg: String? = null
        set(value) {
            val changed = field != value
            field = value
            if (changed && value != null) startProbe(value)
        }

    /** Читает Bluetooth Music прямо на магнитоле и слушает его рассылки о треке. */
    val probe = BtProbe(ctx) { t ->
        handler.post {
            broadcast = t
            publish()
        }
    }

    private fun startProbe(pkg: String) {
        scope.launch {
            val actions = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) { probe.scan(pkg) }
            probe.listen(actions)
            publish()
        }
    }

    /** Кнопки ▶ ⏭ ⏮ напрямую в Bluetooth Music (если у него нет своей сессии плеера). */
    private fun sendToBt(code: Int): Boolean {
        val pkg = fallbackPkg ?: return false
        for (action in listOf(KeyEvent.ACTION_DOWN, KeyEvent.ACTION_UP)) {
            runCatching {
                ctx.sendBroadcast(
                    Intent(Intent.ACTION_MEDIA_BUTTON).setPackage(pkg).putExtra(Intent.EXTRA_KEY_EVENT, KeyEvent(action, code))
                )
            }
        }
        return true
    }

    private var controller: MediaController? = null
    private var sessions: List<MediaController> = emptyList()
    private var listening = false
    private var broadcast: AltTrack? = null
    private var lastArtSrc: Bitmap? = null
    private var lastArt: ImageBitmap? = null

    private val covers = LinkedHashMap<String, ImageBitmap?>()
    private val pending = HashSet<String>()

    private val cb = object : MediaController.Callback() {
        override fun onMetadataChanged(metadata: MediaMetadata?) = publish()
        override fun onPlaybackStateChanged(state: PlaybackState?) = publish()
        override fun onSessionDestroyed() = refresh()
    }
    private val sessionsListener = MediaSessionManager.OnActiveSessionsChangedListener { list ->
        pick(list ?: emptyList())
    }

    private val receiver = object : BroadcastReceiver() {
        override fun onReceive(c: Context, i: Intent) {
            parseBroadcast(i)?.let {
                broadcast = it
                publish()
            }
        }
    }

    init {
        MediaBus.onNotification = { handler.post { publish() } }
        val filter = IntentFilter().apply { BROADCASTS.forEach { addAction(it) } }
        ContextCompat.registerReceiver(ctx, receiver, filter, ContextCompat.RECEIVER_EXPORTED)
    }

    fun start() {
        access.value = NotificationManagerCompat.getEnabledListenerPackages(ctx).contains(ctx.packageName)
        if (access.value && !listening) {
            try {
                msm.addOnActiveSessionsChangedListener(sessionsListener, comp, handler)
                listening = true
            } catch (e: SecurityException) {
                access.value = false
            }
        }
        refresh()
    }

    fun refresh() {
        if (!access.value) {
            publish()
            return
        }
        try {
            pick(msm.getActiveSessions(comp))
        } catch (e: SecurityException) {
            access.value = false
            publish()
        }
    }

    private fun pick(list: List<MediaController>) {
        sessions = list
        // Плееры на самой магнитоле (её Яндекс Музыка и т.п.) не показываем, если выбрано «только телефон».
        val pool = if (phoneOnly) list.filter { isPhone(it.packageName) } else list
        // Пустые сессии (например, TLink без CarPlay) не считаем плеером.
        val best = pool.firstOrNull { it.playbackState?.state == PlaybackState.STATE_PLAYING }
            ?: pool.firstOrNull { !it.metadata?.getString(MediaMetadata.METADATA_KEY_TITLE).isNullOrBlank() }
        if (best?.sessionToken != controller?.sessionToken) {
            controller?.unregisterCallback(cb)
            controller = best
            best?.registerCallback(cb, handler)
        }
        publish()
    }

    private fun label(pkg: String): String = runCatching {
        val pm = ctx.packageManager
        pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0)).toString()
    }.getOrDefault(pkg)

    private fun fromSession(c: MediaController): MediaInfo {
        val m = c.metadata
        val s = c.playbackState
        val bmp = m?.getBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART)
            ?: m?.getBitmap(MediaMetadata.METADATA_KEY_ART)
            ?: m?.getBitmap(MediaMetadata.METADATA_KEY_DISPLAY_ICON)
        if (bmp !== lastArtSrc) {
            lastArtSrc = bmp
            lastArt = bmp?.let { CoverApi.scale(it).asImageBitmap() }
        }
        return MediaInfo(
            pkg = c.packageName,
            appLabel = label(c.packageName),
            title = m?.getString(MediaMetadata.METADATA_KEY_TITLE)
                ?: m?.getString(MediaMetadata.METADATA_KEY_DISPLAY_TITLE) ?: "",
            artist = m?.getString(MediaMetadata.METADATA_KEY_ARTIST)
                ?: m?.getString(MediaMetadata.METADATA_KEY_ALBUM_ARTIST) ?: "",
            art = lastArt,
            duration = m?.getLong(MediaMetadata.METADATA_KEY_DURATION) ?: 0L,
            position = s?.position ?: 0L,
            updateTime = s?.lastPositionUpdateTime?.takeIf { it > 0 } ?: SystemClock.elapsedRealtime(),
            speed = s?.playbackSpeed ?: 1f,
            playing = s?.state == PlaybackState.STATE_PLAYING,
        )
    }

    private fun fromAlt(t: AltTrack): MediaInfo {
        val pkg = t.pkg ?: fallbackPkg ?: ""
        return MediaInfo(
            pkg = pkg,
            appLabel = if (pkg.isNotBlank()) label(pkg) else "Bluetooth Music",
            title = t.title,
            artist = t.artist,
            art = null,
            duration = t.duration,
            position = t.position.coerceAtLeast(0),
            updateTime = t.time,
            speed = 1f,
            playing = t.playing ?: true,
        )
    }

    private fun publish() {
        val c = controller
        val session = c?.let { fromSession(it) }
        val alt = listOfNotNull(broadcast, MediaBus.lastNotification).maxByOrNull { it.time }
        var result = when {
            session != null && session.title.isNotBlank() -> session
            alt != null -> fromAlt(alt).let { a -> if (session != null) a.copy(playing = session.playing || a.playing) else a }
            else -> session
        }
        if (result != null && result.art == null && result.title.isNotBlank()) {
            val key = (result.artist + "|" + result.title).lowercase()
            if (covers.containsKey(key)) {
                result = result.copy(art = covers[key])
            } else if (pending.add(key)) {
                val r = result
                scope.launch {
                    val bmp = CoverApi.find(r.artist, r.title)?.asImageBitmap()
                    covers[key] = bmp
                    while (covers.size > 40) covers.remove(covers.keys.first())
                    pending.remove(key)
                    publish()
                }
            }
        }
        info.value = result
        debug.value = describe(alt, result)
    }

    private val tf = SimpleDateFormat("HH:mm:ss", Locale.US)

    private fun describe(@Suppress("UNUSED_PARAMETER") alt: AltTrack?, result: MediaInfo?): String = buildString {
        appendLine("Доступ к уведомлениям: " + if (access.value) "есть" else "НЕТ")
        appendLine()
        appendLine("Сессии плееров (${sessions.size}):")
        if (sessions.isEmpty()) appendLine("  — нет")
        sessions.forEach { s ->
            val t = s.metadata?.getString(MediaMetadata.METADATA_KEY_TITLE).orEmpty()
            val mark = if (!phoneOnly || isPhone(s.packageName)) "" else "  [на магнитоле — скрыт]"
            appendLine("  • ${s.packageName}: " + t.ifBlank { "(без названия)" } + mark)
        }
        appendLine()
        val n = MediaBus.lastNotification
        appendLine("Уведомление: " + (n?.let { "${it.pkg} — ${it.title} / ${it.artist}" } ?: "—"))
        appendLine("Системная рассылка: " + (broadcast?.let { "${it.source} — ${it.title} / ${it.artist}" } ?: "—"))
        appendLine("Пакет Bluetooth Music: " + (fallbackPkg ?: "не найден"))
        appendLine()
        appendLine("На экране: " + (result?.let { "${it.title} — ${it.artist}" } ?: "ничего"))
        appendLine("Обложка: " + when {
            result == null -> "—"
            result.art != null -> "есть"
            pending.isNotEmpty() -> "ищем в интернете…"
            else -> "не найдена"
        })
        appendLine()
        appendLine("Bluetooth Music изнутри (${probe.pkg ?: "ещё не прочитан"}):")
        appendLine("  рассылок найдено: ${probe.actions.size}, слушаем все")
        appendLine("  кнопки плеера: " + when {
            probe.controls.isNotEmpty() -> "команды Bluetooth Music: " + probe.controls.keys.joinToString()
            btTakesButtons() -> "напрямую в Bluetooth Music"
            else -> "системные медиа-кнопки"
        })
        appendLine("  последняя команда: ${probe.lastSent}")
        appendLine("  проверены приложения: " + probe.scanned.joinToString())
        appendLine("  принимает (${probe.accepted.size}): " + probe.accepted.take(25).joinToString { it.substringAfterLast('.') })
        if (probe.providers.isNotEmpty()) appendLine("  провайдеры: " + probe.providers.joinToString())
        if (probe.services.isNotEmpty()) appendLine("  службы: " + probe.services.joinToString { it.substringAfterLast('.') })
        if (probe.commands.isNotEmpty()) appendLine("  команды: " + probe.commands.take(12).joinToString { it.substringAfterLast('.') })
        appendLine("  пойманные рассылки:")
        if (probe.heard.isEmpty()) appendLine("    — пока ничего (переключите трек на телефоне)")
        probe.heard.forEach { appendLine("    • $it") }
        appendLine("  примеры найденных: " + probe.actions.take(15).joinToString { it.substringAfterLast('.') })
        appendLine()
        appendLine("Последние уведомления на магнитоле:")
        if (MediaBus.recent.isEmpty()) appendLine("  — нет")
        MediaBus.recent.forEach { appendLine("  • $it") }
        appendLine()
        appendLine("Погода и город:")
        if (NetInfo.log.isEmpty()) appendLine("  — ещё не запрашивали")
        NetInfo.log.forEach { appendLine("  • $it") }
        appendLine()
        append("Обновлено: " + tf.format(Date()))
    }

    private fun str(ex: Bundle, vararg keys: String): String? =
        keys.firstNotNullOfOrNull { k -> runCatching { ex.get(k) }.getOrNull()?.toString()?.takeIf { it.isNotBlank() } }

    private fun num(ex: Bundle, vararg keys: String): Long? =
        keys.firstNotNullOfOrNull { k -> (runCatching { ex.get(k) }.getOrNull() as? Number)?.toLong() }

    @Suppress("DEPRECATION")
    private fun parseBroadcast(i: Intent): AltTrack? {
        val ex = i.extras ?: return null
        val md = runCatching { ex.get(AVRCP_EXTRA_METADATA) as? MediaMetadata }.getOrNull()
        val title = md?.getString(MediaMetadata.METADATA_KEY_TITLE) ?: str(ex, "track", "title", "name", "song", "songName")
        if (title.isNullOrBlank()) return null
        val artist = md?.getString(MediaMetadata.METADATA_KEY_ARTIST) ?: str(ex, "artist", "singer", "artistName").orEmpty()
        val duration = md?.getLong(MediaMetadata.METADATA_KEY_DURATION)?.takeIf { it > 0 } ?: num(ex, "duration", "totalTime") ?: 0L
        val playing = (runCatching { ex.get("playing") ?: ex.get("isPlaying") }.getOrNull() as? Boolean)
        return AltTrack(
            source = i.action ?: "?",
            pkg = null,
            title = title,
            artist = artist,
            duration = duration,
            position = num(ex, "position", "currentTime") ?: -1,
            playing = playing,
        )
    }

    fun playPause() {
        val c = controller
        if (c == null) {
            val start = onNothingToPlay
            val cur = info.value
            when {
                cur == null && start != null -> start()
                // Bluetooth Music понимает только одну кнопку «Плей/Пауза», как на руле:
                // отдельные «Пауза» и «Плей» роняли его.
                else -> key(KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE)
            }
            return
        }
        if (c.playbackState?.state == PlaybackState.STATE_PLAYING) c.transportControls.pause()
        else c.transportControls.play()
    }

    fun next() {
        val c = controller
        if (c != null) c.transportControls.skipToNext() else key(KeyEvent.KEYCODE_MEDIA_NEXT)
    }

    fun prev() {
        val c = controller
        if (c != null) c.transportControls.skipToPrevious() else key(KeyEvent.KEYCODE_MEDIA_PREVIOUS)
    }

    /** Принимает ли Bluetooth Music кнопки плеера напрямую. */
    private fun btTakesButtons(): Boolean = fallbackPkg?.let { p ->
        runCatching {
            ctx.packageManager.queryBroadcastReceivers(Intent(Intent.ACTION_MEDIA_BUTTON).setPackage(p), 0).isNotEmpty()
        }.getOrDefault(false)
    } ?: false

    /**
     * Разбудить Bluetooth Music без окна: запустить его службы и, если ничего не играет, нажать «Плей/Пауза».
     * Возвращает true, если удалось запустить хотя бы одну службу.
     */
    fun wakeBt(): Boolean {
        val pkg = fallbackPkg ?: return false
        var started = false
        probe.services.forEach { cls ->
            runCatching { ctx.startService(Intent().setClassName(pkg, cls)) }.onSuccess { if (it != null) started = true }
        }
        if (info.value?.playing != true) key(KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE)
        return started
    }

    /** Одна кнопка — один путь, чтобы «следующий трек» не срабатывал дважды. */
    fun key(code: Int) {
        // 1) Команды, которые Bluetooth Music точно принимает (нашли сами в его коде).
        val kind = when (code) {
            KeyEvent.KEYCODE_MEDIA_NEXT -> "next"
            KeyEvent.KEYCODE_MEDIA_PREVIOUS -> "prev"
            else -> "toggle"
        }
        if (kind == "toggle") {
            if (probe.send("toggle")) return
            val playing = info.value?.playing == true
            if (probe.send(if (playing) "pause" else "play")) return
        } else if (probe.send(kind)) return
        // 2) Кнопка плеера напрямую, 3) системная медиа-кнопка.
        if (btTakesButtons() && sendToBt(code)) return
        am.dispatchMediaKeyEvent(KeyEvent(KeyEvent.ACTION_DOWN, code))
        am.dispatchMediaKeyEvent(KeyEvent(KeyEvent.ACTION_UP, code))
    }

    fun close() {
        probe.close()
        runCatching { ctx.unregisterReceiver(receiver) }
        MediaBus.onNotification = null
    }

    companion object {
        private const val AVRCP_EXTRA_METADATA = "android.bluetooth.avrcp-controller.profile.extra.METADATA"
        private val BROADCASTS = listOf(
            "android.bluetooth.avrcp-controller.profile.action.TRACK_EVENT",
            "com.android.music.metachanged",
            "com.android.music.playstatechanged",
            "com.android.music.playbackcomplete",
            "com.android.bluetooth.music.metachanged",
            "com.android.bt.music.metachanged",
            "com.bt.music.metachanged",
        )
    }
}
