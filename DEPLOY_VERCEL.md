# Инструкция по деплою «Ритм.» на Vercel (с базой данных Turso)

Проект полностью подготовлен для работы в serverless-среде Vercel.  
Благодаря драйверу `@libsql/client`:
- **Локально**: проект работает автономно с файлом `data/ritm.db` (если переменные не заданы).
- **На Vercel**: проект подключается к облачному SQLite в Turso через переменные окружения.

---

## Шаг 1. Создание облачной базы данных в Turso (2 минуты, бесплатно)

1. Перейдите на сайт [turso.tech](https://turso.tech) и зарегистрируйтесь (можно через GitHub).
2. Создайте новую базу данных:
   - В веб-интерфейсе Turso нажмите **Create Database** (назовите её, например, `ritm-db`).
   - *Или через терминал:*
     ```bash
     brew install tursodatabase/tap/turso
     turso auth login
     # Создать базу с загрузкой текущих данных из локального файла:
     turso db create ritm-db --from-file ./data/ritm.db
     ```
3. Скопируйте два значения:
   - **Database URL**: вида `libsql://ritm-db-<username>.turso.io`
   - **Auth Token**: создаётся в панели или командой `turso db tokens create ritm-db`

*(Если создавали базу через веб-интерфейс пустой, примените миграции локально:  
`DATABASE_URL=... DATABASE_AUTH_TOKEN=... npm run db:migrate`  
и при желании сид: `DATABASE_URL=... DATABASE_AUTH_TOKEN=... npm run db:seed`)*

---

## Шаг 2. Загрузка кода в GitHub

В папке проекта выполните:
```bash
git add .
git commit -m "feat: migrate to LibSQL/Turso for Vercel deployment"
```

Создайте новый репозиторий на [github.com/new](https://github.com/new) (например `ritm`) и выполните команды, которые покажет GitHub:
```bash
git remote add origin https://github.com/<ваш-логин>/ritm.git
git branch -M main
git push -u origin main
```

---

## Шаг 3. Деплой на Vercel

1. Зайдите на [vercel.com](https://vercel.com) под вашим аккаунтом GitHub.
2. Нажмите **Add New...** → **Project**.
3. Выберите репозиторий `ritm` и нажмите **Import**.
4. В блоке **Environment Variables** добавьте две переменные:
   - `DATABASE_URL` = `libsql://ritm-db-<username>.turso.io`
   - `DATABASE_AUTH_TOKEN` = ваш токен Turso
5. Нажмите **Deploy**.

Готово! Через 1-2 минуты проект будет опубликован и доступен по постоянному адресу (например, `ritm-xxx.vercel.app`).
Любые созданные задачи, заметки и изменения будут сохраняться в облаке и будут доступны с любых устройств 24/7.
