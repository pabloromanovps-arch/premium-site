package app.spa.launcher

import android.service.notification.NotificationListenerService

/**
 * Пустой сервис. Он нужен только для того, чтобы система дала лаунчеру
 * доступ к активным плеерам: показать трек и переключать его с главного экрана.
 */
class MediaListenerService : NotificationListenerService()
