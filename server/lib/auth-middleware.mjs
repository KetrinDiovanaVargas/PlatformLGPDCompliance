/**
 * Middlewares de autenticação e autorização com Firebase Admin SDK.
 * 
 * Implementa verificação de token JWT, validação de role de admin e MASTER.
 * @module middleware/auth
 */

import { getAdminAuth } from '../firebaseAdmin.mjs';

/**
 * Middleware de autenticação com Firebase ID Token.
 * 
 * Extrai e valida token JWT do header Authorization.
 * Anexa dados do usuário autenticado em req.user.
 * 
 * @async
 * @param {Object} req - Request Express
 * @param {Object} req.headers - Headers HTTP
 * @param {string} [req.headers.authorization] - Bearer token JWT
 * @param {Object} res - Response Express
 * @param {Function} next - Middleware next callback
 * 
 * @returns {void} Chama next() se autenticado, ou retorna erro 401
 * 
 * @example
 * app.use(authMiddleware);
 * // req.user = { uid: string, email: string, isAdmin: boolean }
 * 
 * @throws {401} Se token não fornecido, expirado ou inválido
 */
export async function authMiddleware(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Token não fornecido. Use: Authorization: Bearer <token>',
      });
    }

    const auth = getAdminAuth();
    const decodedToken = await auth.verifyIdToken(token);

    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      isAdmin: decodedToken.isAdmin || false,
    };

    next();
  } catch (error) {
    console.error('❌ Auth error:', error.message);

    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({
        error: 'Token expirado',
        message: 'Faça login novamente',
      });
    }

    if (error.code === 'auth/invalid-id-token') {
      return res.status(401).json({
        error: 'Token inválido',
        message: 'Faça login novamente',
      });
    }

    res.status(401).json({
      error: 'Unauthorized',
      message: 'Falha na autenticação',
    });
  }
}

/**
 * Middleware de autorização para admin.
 * 
 * Verifica se usuário autenticado existe e tem papel de admin ativo.
 * Consulta collection 'admins' no Firestore para validar role.
 * 
 * **Requer authMiddleware antes nesta rota.**
 * 
 * @async
 * @param {Object} req - Request Express
 * @param {Object} req.user - Usuário autenticado (de authMiddleware)
 * @param {string} req.user.uid - ID do usuário
 * @param {Object} res - Response Express
 * @param {Function} next - Middleware next callback
 * 
 * @returns {void} Chama next() se admin ativo, ou retorna erro 401/403
 * 
 * @example
 * app.post('/api/admin/assessment', authMiddleware, adminMiddleware, handler);
 * // req.admin = { uid, email, isAdmin, role: "ADMIN"|"MASTER", active: boolean }
 * 
 * @throws {401} Se usuário não autenticado
 * @throws {403} Se usuário não é admin ou foi desativado
 * @throws {500} Se erro ao consultar Firestore
 */
export async function adminMiddleware(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Autenticação necessária',
    });
  }

  try {
    const { getAdminDb } = await import('../firebaseAdmin.mjs');
    const db = getAdminDb();

    const adminDoc = await db.collection('admins').doc(req.user.uid).get();

    if (!adminDoc.exists || !adminDoc.data().active) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Usuário não é admin ou foi desativado',
      });
    }

    req.admin = {
      ...req.user,
      role: adminDoc.data().role,
      active: adminDoc.data().active,
    };

    next();
  } catch (error) {
    console.error('❌ Admin middleware error:', error.message);
    res.status(500).json({
      error: 'Internal server error',
    });
  }
}

/**
 * Middleware de autorização para MASTER admin.
 * 
 * Verifica se usuário tem role 'MASTER' (acesso máximo).
 * 
 * **Requer adminMiddleware antes nesta rota.**
 * 
 * @param {Object} req - Request Express
 * @param {Object} req.admin - Admin autenticado (de adminMiddleware)
 * @param {string} req.admin.role - Role do admin ("ADMIN" ou "MASTER")
 * @param {Object} res - Response Express
 * @param {Function} next - Middleware next callback
 * 
 * @returns {void} Chama next() se MASTER, ou retorna erro 403
 * 
 * @example
 * app.delete('/api/admin/user/:id', authMiddleware, adminMiddleware, masterMiddleware, handler);
 * // Apenas MASTER pode executar
 * 
 * @throws {403} Se admin não é MASTER
 */
export async function masterMiddleware(req, res, next) {
  if (!req.admin || req.admin.role !== 'MASTER') {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Apenas MASTER admins podem acessar este recurso',
    });
  }

  next();
}