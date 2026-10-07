const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware для разбора JSON
app.use(express.json());

// --- Логирование в файл access.log ---
const logFilePath = path.join(__dirname, 'access.log');
app.use((req, res, next) => {
  const logEntry = `[${new Date().toISOString()}] ${req.method} ${req.url}\n`;
  fs.appendFile(logFilePath, logEntry, (err) => {
    if (err) console.error('Ошибка записи в log-файл:', err);
  });
  next();
});

// --- База данных в памяти (In-Memory DB) ---
let courses = [
  { id: 1, title: 'JavaScript для начинающих', level: 'beginner', price: 15000, description: 'Основы JS и DOM' },
  { id: 2, title: 'Node.js и Express REST API', level: 'intermediate', price: 25000, description: 'Бэкенд разработка' },
  { id: 3, title: 'Продвинутый React и Redux', level: 'advanced', price: 35000, description: 'Архитектура фронтенд приложений' },
  { id: 4, title: 'HTML и CSS с нуля', level: 'beginner', price: 10000, description: 'Верстка сайтов' },
  { id: 5, title: 'TypeScript в деталях', level: 'intermediate', price: 28000, description: 'Типизация в JS' }
];

let nextId = 6;
const ALLOWED_LEVELS = ['beginner', 'intermediate', 'advanced', 'базовый', 'средний', 'продвинутый'];

// --- Вспомогательные функции валидации ---
function validateCourseData(data, isPartial = false) {
  const errors = [];

  if (!isPartial || data.title !== undefined) {
    if (!data.title || typeof data.title !== 'string' || data.title.trim() === '') {
      errors.push('Поле "title" обязательно и должно быть непустой строкой.');
    }
  }

  if (!isPartial || data.level !== undefined) {
    if (!data.level || typeof data.level !== 'string' || !ALLOWED_LEVELS.includes(data.level.toLowerCase())) {
      errors.push(`Поле "level" обязательно. Допустимые значения: ${ALLOWED_LEVELS.join(', ')}.`);
    }
  }

  if (!isPartial || data.price !== undefined) {
    if (data.price === undefined || typeof data.price !== 'number' || data.price < 0) {
      errors.push('Поле "price" обязательно и должно быть неотрицательным числом.');
    }
  }

  return errors;
}

// ==========================================
// МАРШРУТЫ (ENDPOINTS)
// ==========================================

// 1. Статистика (GET /courses/stats)
// Специфика Варианта 9: Количество курсов по уровням + общая статистика
app.get('/courses/stats', (req, res) => {
  const totalCount = courses.length;
  
  const countByLevel = courses.reduce((acc, course) => {
    const lvl = course.level.toLowerCase();
    acc[lvl] = (acc[lvl] || 0) + 1;
    return acc;
  }, {});

  const totalPrice = courses.reduce((sum, c) => sum + c.price, 0);
  const averagePrice = totalCount > 0 ? Number((totalPrice / totalCount).toFixed(2)) : 0;

  res.json({
    totalCourses: totalCount,
    averagePrice: averagePrice,
    countByLevel: countByLevel
  });
});

// 2. Массовое создание элементов (POST /courses/bulk)
app.post('/courses/bulk', (req, res) => {
  const items = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Тело запроса должно содержать непустой массив элементов.' });
  }

  const createdCourses = [];

  for (let i = 0; i < items.length; i++) {
    const errors = validateCourseData(items[i]);
    if (errors.length > 0) {
      return res.status(400).json({
        error: `Ошибка валидации в элементе с индексом ${i}`,
        details: errors
      });
    }
  }

  items.forEach(item => {
    const newCourse = {
      id: nextId++,
      title: item.title.trim(),
      level: item.level.toLowerCase(),
      price: item.price,
      description: item.description || ''
    };
    courses.push(newCourse);
    createdCourses.push(newCourse);
  });

  res.status(201).json(createdCourses);
});

// 3. Получение списка элементов с поиском, сортировкой и пагинацией (GET /courses)
app.get('/courses', (req, res) => {
  let result = [...courses];
  const { search, sort, order, page, limit } = req.query;

  // Поиск по названию
  if (search) {
    const searchLower = search.toLowerCase();
    result = result.filter(course => course.title.toLowerCase().includes(searchLower));
  }

  // Сортировка
  if (sort) {
    const sortOrder = order === 'desc' ? -1 : 1;
    result.sort((a, b) => {
      if (a[sort] < b[sort]) return -1 * sortOrder;
      if (a[sort] > b[sort]) return 1 * sortOrder;
      return 0;
    });
  }

  // Пагинация
  const pageNum = parseInt(page, 10) || 1;
  const limitNum = parseInt(limit, 10) || 10;
  const startIndex = (pageNum - 1) * limitNum;
  const endIndex = pageNum * limitNum;

  const paginatedResult = result.slice(startIndex, endIndex);

  res.json({
    total: result.length,
    page: pageNum,
    limit: limitNum,
    data: paginatedResult
  });
});

// 4. Связанные элементы (GET /courses/:id/related)
// Специфика Варианта 9: Связь по одинаковому уровню (level)
app.get('/courses/:id/related', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const targetCourse = courses.find(c => c.id === id);

  if (!targetCourse) {
    return res.status(404).json({ error: 'Курс не найден' });
  }

  const related = courses.filter(
    c => c.level.toLowerCase() === targetCourse.level.toLowerCase() && c.id !== targetCourse.id
  );

  res.json(related);
});

// 5. Получение одного элемента по ID (GET /courses/:id)
app.get('/courses/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const course = courses.find(c => c.id === id);

  if (!course) {
    return res.status(404).json({ error: 'Курс не найден' });
  }

  res.json(course);
});

// 6. Создание одного элемента (POST /courses)
app.post('/courses', (req, res) => {
  const errors = validateCourseData(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  const newCourse = {
    id: nextId++,
    title: req.body.title.trim(),
    level: req.body.level.toLowerCase(),
    price: req.body.price,
    description: req.body.description || ''
  };

  courses.push(newCourse);
  res.status(201).json(newCourse);
});

// 7. Полное обновление элемента (PUT /courses/:id)
app.put('/courses/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const index = courses.findIndex(c => c.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Курс не найден' });
  }

  const errors = validateCourseData(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  courses[index] = {
    id: id,
    title: req.body.title.trim(),
    level: req.body.level.toLowerCase(),
    price: req.body.price,
    description: req.body.description || ''
  };

  res.json(courses[index]);
});

// 8. Частичное обновление элемента (PATCH /courses/:id)
app.patch('/courses/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const course = courses.find(c => c.id === id);

  if (!course) {
    return res.status(404).json({ error: 'Курс не найден' });
  }

  const errors = validateCourseData(req.body, true);
  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  if (req.body.title !== undefined) course.title = req.body.title.trim();
  if (req.body.level !== undefined) course.level = req.body.level.toLowerCase();
  if (req.body.price !== undefined) course.price = req.body.price;
  if (req.body.description !== undefined) course.description = req.body.description;

  res.json(course);
});

// 9. Удалить все элементы (DELETE /courses)
app.delete('/courses', (req, res) => {
  courses = [];
  res.status(204).send();
});

// 10. Удаление одного элемента (DELETE /courses/:id)
app.delete('/courses/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const index = courses.findIndex(c => c.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Курс не найден' });
  }

  courses.splice(index, 1);
  res.status(204).send();
});

// --- Глобальная обработка ошибок 500 ---
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Внутренняя ошибка сервера (500 Internal Server Error)' });
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});