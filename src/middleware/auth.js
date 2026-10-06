import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'barbearia_super_secret_jwt_key_2026_devsecops';
const JWT_EXPIRES_IN = '8h';

/**
 * Generate JWT token for an authenticated user
 */
export function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneVerified
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

/**
 * Middleware to authenticate requests using JWT Bearer token
 */
export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    return res.status(401).json({ error: 'Acesso não autorizado. Token JWT ausente.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Sessão expirada. Faça login novamente.' });
    }
    return res.status(403).json({ error: 'Token inválido ou adulterado.' });
  }
}

/**
 * Optional authentication middleware (for routes accessible by both guests and logged-in users)
 */
export function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
    } catch {
      req.user = null;
    }
  } else {
    req.user = null;
  }
  next();
}

/**
 * Role-Based Access Control (RBAC) middleware
 * @param {string[]} allowedRoles - Array of roles allowed (e.g. ['ADMIN', 'SECRETARIA'])
 */
export function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Não autenticado.' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Acesso negado. Ação restrita a perfil (${allowedRoles.join(' ou ')}). Seu perfil atual: ${req.user.role}.`
      });
    }

    next();
  };
}
