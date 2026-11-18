package app.spa.launcher.data

import android.content.ComponentName
import android.content.Context
import android.graphics.Bitmap
import android.media.AudioManager
import android.media.MediaMetadata
import android.media.session.MediaController
import android.media.session.MediaSessionManager
import android.media.session.PlaybackState
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.view.KeyEvent
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.core.app.NotificationManagerCompat
import app.spa.launcher.MediaListenerService
import kotlinx.coroutines.flow.MutableStateFlow

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

/** Текущий трек из любого плеера (Яндекс Музыка, VK, CarPlay и т.д.) через доступ к уведомлениям. */
class MediaRepo(private val ctx: Context) {
    private val msm = ctx.getSystemService(MediaSessionManager::class.java)
    private val am = ctx.getSystemService(AudioManager::class.java)
    private val comp = ComponentName(ctx, MediaListenerService::class.java)
    private val handler = Handler(Looper.getMainLooper())

    val info = MutableStateFlow<MediaInfo?>(null)
    val access = MutableStateFlow(false)

    private var controller: MediaController? = null
    private var listening = false
    private var lastArtSrc: Bitmap? = null
    private var lastArt: ImageBitmap? = null

    private val cb = object : MediaController.Callback() {
        override fun onMetadataChanged(metadata: MediaMetadata?) = publish()
        override fun onPlaybackStateChanged(state: PlaybackState?) = publish()
        override fun onSessionDestroyed() = refresh()
    }
    private val sessionsListener = MediaSessionManager.OnActiveSessionsChangedListener { list ->
        pick(list ?: emptyList())
    }

    fun start() {
        access.value = NotificationManagerCompat.getEnabledListenerPackages(ctx).contains(ctx.packageName)
        if (!access.value) return
        if (!listening) {
            try {
                msm.addOnActiveSessionsChangedListener(sessionsListener, comp, handler)
                listening = true
            } catch (e: SecurityException) {
                access.value = false
                return
            }
        }
        refresh()
    }

    fun refresh() {
        try {
            pick(msm.getActiveSessions(comp))
        } catch (e: SecurityException) {
            access.value = false
        }
    }

    private fun pick(list: List<MediaController>) {
        val best = list.firstOrNull { it.playbackState?.state == PlaybackState.STATE_PLAYING } ?: list.firstOrNull()
        if (best?.sessionToken != controller?.sessionToken) {
            controller?.unregisterCallback(cb)
            controller = best
            best?.registerCallback(cb, handler)
        }
        publish()
    }

    private fun publish() {
        val c = controller ?: run { info.value = null; return }
        val m = c.metadata
        val s = c.playbackState
        val bmp = m?.getBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART)
            ?: m?.getBitmap(MediaMetadata.METADATA_KEY_ART)
            ?: m?.getBitmap(MediaMetadata.METADATA_KEY_DISPLAY_ICON)
        if (bmp !== lastArtSrc) {
            lastArtSrc = bmp
            lastArt = bmp?.let { scale(it).asImageBitmap() }
        }
        val label = runCatching {
            val pm = ctx.packageManager
            pm.getApplicationLabel(pm.getApplicationInfo(c.packageName, 0)).toString()
        }.getOrDefault(c.packageName)
        info.value = MediaInfo(
            pkg = c.packageName,
            appLabel = label,
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

    private fun scale(b: Bitmap): Bitmap {
        if (b.width <= 320) return b
        val h = (320f * b.height / b.width).toInt().coerceAtLeast(1)
        return Bitmap.createScaledBitmap(b, 320, h, true)
    }

    fun playPause() {
        val c = controller
        if (c == null) {
            key(KeyEvent.KEYCODE_MEDIA_PLAY)
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

    private fun key(code: Int) {
        am.dispatchMediaKeyEvent(KeyEvent(KeyEvent.ACTION_DOWN, code))
        am.dispatchMediaKeyEvent(KeyEvent(KeyEvent.ACTION_UP, code))
    }
}
