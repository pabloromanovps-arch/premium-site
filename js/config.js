// Настройки интеграций.
// webhookUrl — адрес сервера из server/worker.mjs. Если пусто, заявки хранятся только в браузере (демо-режим).
(self.Flora = self.Flora || {}).config = {
  webhookUrl: "",
};
