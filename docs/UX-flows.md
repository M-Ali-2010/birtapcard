# Карта UX-сценариев BirTapCard Restaurant Service

## 1. Текущий сценарий (As-Is) с тупиками и потерями состояния

```mermaid
flowchart TD
    %% Точки входа
    QR[QR / NFC на столе] --> Menu[Меню ресторана: /restaurant/:slug/table/:number]
    
    %% Меню и корзина
    Menu --> Search[Поиск по блюдам]
    Menu --> AddItem[Добавление в корзину]
    AddItem --> Cart[Корзина / Заказ]
    
    %% Проблемы меню и корзины
    Cart -.->|Тупик 1: Обновление страницы F5| LostCart[ПОТЕРЯ: Корзина очищается, сессии нет]
    Cart -.->|Тупик 2: Нет фильтра аллергенов| AllergyRisk[РИСК: Гость не видит скрытые аллергены]
    Cart -.->|Тупик 3: Нет заметок к позициям| NoNotes[Нельзя указать 'без лука' для одного блюда]
    
    %% Оформление
    Cart --> SubmitOrder[Кнопка 'Отправить на кухню']
    SubmitOrder --> OrderTrack[Экран заказа: /restaurant/order/:token]
    
    %% Проблемы экрана отслеживания
    OrderTrack -.->|Тупик 4: Жест 'Назад' в браузере| BrokenBack[ПОТЕРЯ: Возврат в пустую корзину или дубль отправки]
    OrderTrack -.->|Тупик 5: Нет кнопки 'Меню'| SmallLogo[Неочевидная ссылка в шапке на логотипе]
    OrderTrack -.->|Тупик 6: Статус завершён| NoReorder[Нет кнопки 'Заказать ещё' внизу]
    
    %% Отзыв
    OrderTrack --> LeaveReview[Оставить отзыв: звёзды + текст]
    LeaveReview --> SentReview[Экран 'Спасибо за отзыв']
    SentReview -.->|Тупик 7: Финал без действий| TotalDeadEnd[ТУПИК: Ни кнопок, ни 'Заказать ещё', ни 'Попросить счёт']
    
    %% Персонал
    Login[Логин сотрудника: /login] --> DashRedirect[Всегда редирект в /dashboard]
    DashRedirect -.->|Проблема персонала| NoRoleRouting[Повару/официанту нужно вручную искать /restaurant-admin]
    StaffAdmin[/restaurant-admin/:id/:section] --> AdminAll[Админка показывает ВСЕ 6 разделов любой роли]
    AdminAll -.->|Опасное действие: onChange select| DangerPay[ОШИБКА: Случайное касание сразу отмечает 'Оплачено' без отмены]
```

---

## 2. Целевой сценарий (To-Be) — Seamless Flow без тупиков

```mermaid
flowchart TD
    %% Гостевой путь
    GuestEntry[QR / NFC касание стола] --> GuestSession[Инициализация сессии rm:v1:slug:table]
    GuestSession --> TargetMenu[Меню ресторана со статусом стола]
    
    TargetMenu --> ActiveBanner{Есть активный заказ?}
    ActiveBanner -- Да --> OrderBanner[Закреплённый баннер: 'Заказ №N · Готовится' → переход в трекинг]
    ActiveBanner -- Нет --> RegularMenu[Просмотр меню]
    
    RegularMenu --> AllergenFilter[Фильтр 'Без: глютен / молоко / орехи / ...']
    RegularMenu --> DishDetail[Шторка деталей блюда: КБЖУ, аллергены, крупное фото]
    DishDetail --> AddToCart[Добавить в корзину + заметка к блюду]
    AddToCart --> PersistedCart[Корзина сохранена в LocalStorage с TTL 12ч]
    
    PersistedCart --> CartDrawer[Корзина: стол виден, редактирование, отмена удаления]
    CartDrawer --> SafeSubmit[Отправка с idempotency client_request_id + AbortController]
    
    SafeSubmit -->|history.replaceState| OrderView[Экран отслеживания заказа]
    
    %% Экран отслеживания
    OrderView --> TopHeaderNav[Постоянная шапка: кнопка '← Меню', Ресторан, Стол N]
    OrderView --> StatusProgress[4 понятных этапа: Принят → Готовится → Готов → Доставлен]
    OrderView --> CancelAction{Статус 'new'?}
    CancelAction -- Да --> GuestCancel[Кнопка 'Отменить заказ' гостем]
    CancelAction -- Нет --> InProgress[Заказ на кухне]
    
    OrderView --> BottomActions[Закреплённый футер: 'Заказать ещё' → меню стола]
    
    %% Отзыв
    StatusProgress --> ReviewPrompt[Блок отзыва: звёзды, теги впечатлений, комментарий]
    ReviewPrompt --> ReviewSuccess[Блок 'Спасибо!' с кнопками 'Заказать ещё', 'В меню', 'Попросить счёт']
    
    %% Персонал
    StaffLogin[Логин /login?next=...] --> RoleRouter{Проверка роли}
    RoleRouter -- kitchen --> KdsView[/restaurant-admin/:id/kitchen планшетный режим 56px]
    RoleRouter -- staff --> OrdersView[/restaurant-admin/:id/orders с фильтрами и таймерами]
    RoleRouter -- restaurant_admin --> FullAdmin[/restaurant-admin/:id/orders полный доступ]
    RoleRouter -- super_admin --> SuperPlatform[/restaurant-admin/platform вся сеть]
    
    OrdersView --> SafePayment[Кнопка 'Принять оплату' → Модалка выбора метода → Toast с 'Отменить 5с']
```
