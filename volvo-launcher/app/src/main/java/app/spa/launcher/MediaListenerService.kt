package app.spa.launcher

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import app.spa.launcher.data.AltTrack
import app.spa.launcher.data.MediaBus

/**
 * Даёт лаунчеру доступ к плеерам и читает уведомления музыкальных приложений.
 * Так мы узнаём трек из Bluetooth Music, даже если оно не создаёт сессию плеера.
 */
class MediaListenerService : NotificationListenerService() {

    override fun onListenerConnected() {
        runCatching { activeNotifications?.forEach { handle(it) } }
    }

    override fun onNotificationPosted(sbn: StatusBarNotification) = handle(sbn)

    override fun onNotificationRemoved(sbn: StatusBarNotification) {
        if (MediaBus.lastNotification?.pkg == sbn.packageName) MediaBus.post(null)
    }

    private fun handle(sbn: StatusBarNotification) {
        val n = sbn.notification ?: return
        val ex = n.extras ?: return
        val isMusic = n.category == Notification.CATEGORY_TRANSPORT ||
            ex.containsKey(Notification.EXTRA_MEDIA_SESSION) ||
            sbn.packageName in MediaBus.musicPkgs
        if (!isMusic) return
        val title = ex.getCharSequence(Notification.EXTRA_TITLE)?.toString().orEmpty()
        if (title.isBlank()) return
        val text = ex.getCharSequence(Notification.EXTRA_TEXT)?.toString()
            ?: ex.getCharSequence(Notification.EXTRA_SUB_TEXT)?.toString()
            ?: ""
        MediaBus.post(AltTrack(source = "notification", pkg = sbn.packageName, title = title, artist = text))
    }
}
