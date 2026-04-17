import cors from 'cors';
import express from 'express';
import { env } from './config/env.js';
import contentRoutes from './routes/contentRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import enrollmentsRoutes from './routes/enrollmentsRoutes.js';
import lessonsRoutes from './routes/lessonsRoutes.js';
import modulesRoutes from './routes/modulesRoutes.js';
import notificationsRoutes from './routes/notificationsRoutes.js';
import progressRoutes from './routes/progressRoutes.js';
import quizzesRoutes from './routes/quizzesRoutes.js';
import resultsRoutes from './routes/resultsRoutes.js';
import topicsRoutes from './routes/topicsRoutes.js';
import authRoutes from './routes/authRoutes.js';
import usersRoutes from './routes/usersRoutes.js';
import { requireAuth } from './middleware/authMiddleware.js';
import { errorHandler, notFoundHandler } from './middleware/errorMiddleware.js';

export const app = express();

const allowedOrigins = new Set(env.corsOrigins);
const privateLanPattern =
  /^https?:\/\/((192\.168\.\d{1,3}\.\d{1,3})|(10\.\d{1,3}\.\d{1,3}\.\d{1,3})|(172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}))(:\d+)?$/;

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.has('*') || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      if (env.nodeEnv !== 'production' && privateLanPattern.test(origin)) {
        callback(null, true);
        return;
      }

      callback(null, false);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json({ limit: env.requestBodyLimit }));
app.use(express.urlencoded({ extended: true, limit: env.requestBodyLimit }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', requireAuth, usersRoutes);
app.use('/api/modules', requireAuth, modulesRoutes);
app.use('/api/lessons', requireAuth, lessonsRoutes);
app.use('/api/topics', requireAuth, topicsRoutes);
app.use('/api/content', requireAuth, contentRoutes);
app.use('/api/enrollments', requireAuth, enrollmentsRoutes);
app.use('/api/progress', requireAuth, progressRoutes);
app.use('/api/quizzes', requireAuth, quizzesRoutes);
app.use('/api/results', requireAuth, resultsRoutes);
app.use('/api/notifications', requireAuth, notificationsRoutes);
app.use('/api/dashboard', requireAuth, dashboardRoutes);

app.use(notFoundHandler);
app.use(errorHandler);
