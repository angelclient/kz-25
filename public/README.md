# Mini Messenger — Firebase (HTML/CSS/JS)

Функції:
- Авторизація: Email+Пароль, Google, Phone (SMS з reCAPTCHA)
- Чат у глобальній кімнаті з Firestore (realtime onSnapshot)
- Звук на вхідні повідомлення (кнопка «Увімкнути звук» для розблокування автоплею)
- Мінімалістичний UI, темна/світла тема

## Налаштування
1. Створи проект у Firebase Console.
2. Увімкни у Authentication → Sign-in methods: **Email/Password**, **Google**, **Phone**.
3. У `public/firebase-config.js` підстав свій `firebaseConfig`.
4. (Опційно) Додай тестові номери для SMS у консолі Firebase.

## Локальний запуск
Обов'язково запускати через http-сервер (не `file://`). Наприклад:
```bash
cd public
python -m http.server 8000
# або
npx http-server -c-1
```
Потім відкрий `http://localhost:8000`.

## Деплой на Firebase Hosting
```bash
firebase login
firebase init   # Hosting → existing project → public → SPA=Yes
firebase deploy
```
Сайт буде доступний на `https://<project-id>.web.app`.
