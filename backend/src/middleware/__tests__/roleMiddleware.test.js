const roleAuthorization = require('../roleMiddleware');

describe('Role Middleware', () => {
  let req;
  let res;
  let next;
  
  beforeEach(() => {
    req = {
      user: {
        id: 1,
        username: 'testuser',
        role: 'tech'
      }
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    
    next = jest.fn();
  });
  
  it('should call next() if user has the required role', () => {
    const middleware = roleAuthorization(['admin', 'tech', 'purchasing']);
    middleware(req, res, next);
    
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });
  
  it('should return 403 if user does not have the required role', () => {
    const middleware = roleAuthorization(['admin', 'purchasing']);
    middleware(req, res, next);
    
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.any(String)
    }));
  });
  
  it('should return 401 if req.user is not set', () => {
    req.user = undefined;
    const middleware = roleAuthorization(['admin', 'tech', 'purchasing']);
    middleware(req, res, next);
    
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.any(String)
    }));
  });
  
  it('should allow admin role access to all endpoints regardless of specified roles', () => {
    req.user.role = 'admin';
    
    // Test with roles that don't include 'admin'
    const middleware = roleAuthorization(['tech', 'purchasing']);
    middleware(req, res, next);
    
    // Admin should bypass the role check and proceed
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
    
    // Reset the mock
    next.mockReset();
    
    // Test with an empty roles array
    const emptyRolesMiddleware = roleAuthorization([]);
    emptyRolesMiddleware(req, res, next);
    
    // Admin should still bypass even with empty roles array
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });
  
  it('should handle empty roles array for non-admin users', () => {
    req.user.role = 'tech';
    
    const middleware = roleAuthorization([]);
    middleware(req, res, next);
    
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.any(String),
      requiredRoles: [],
      userRole: 'tech'
    }));
  });
}); 