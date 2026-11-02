# Настройка API

Quick и Deep используют настроенные официальные API Twitch, YouTube и GitHub
внутри обычного поиска. Если настройка отсутствует, остальные источники продолжают
работать, а неподтверждённая проверка сохраняет причину. Настройки показывают
наличие credentials без их значений. Наличие ещё не подтверждает, что провайдер
принимает ключ.

В терминале внутри распакованной папки приложения:

```text
NoBodyThingHides.exe credentials set twitch_client_id
NoBodyThingHides.exe credentials set twitch_client_secret
NoBodyThingHides.exe credentials set youtube
NoBodyThingHides.exe credentials set github
NoBodyThingHides.exe credentials status
```

Каждая команда `set` запрашивает значение скрытым вводом и использует существующее
системное хранилище credentials. Twitch требует ID/secret зарегистрированного
приложения, YouTube — ключ Data API v3 с подходящими ограничениями. GitHub token
необязателен для публичных профилей. Не помещайте секреты в аргументы поиска,
отчёты, рецепты или обращения об ошибках.

Публичный парсер Telegram включён. Сетевой MTProto-транспорт не реализован и не
активирован; Bot API token не включает его. Для утверждений о восстановлении
аккаунтов нужны свежие контрольные проверки и живая приёмка провайдера.
См. [как читать результаты](results.md).
