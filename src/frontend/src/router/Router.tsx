import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';

export interface Location {
  pathname: string;
  search: string;
  hash: string;
}

export type NavigateFunction = (to: string, options?: { replace?: boolean }) => void;

interface RouterContextType {
  location: Location;
  navigate: NavigateFunction;
}

const RouterContext = createContext<RouterContextType | null>(null);

export const Router: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [location, setLocation] = useState<Location>(() => ({
    pathname: window.location.pathname,
    search: window.location.search,
    hash: window.location.hash
  }));

  useEffect(() => {
    const handlePopState = () => {
      setLocation({
        pathname: window.location.pathname,
        search: window.location.search,
        hash: window.location.hash
      });
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate: NavigateFunction = (to, options) => {
    if (options?.replace) {
      window.history.replaceState(null, '', to);
    } else {
      window.history.pushState(null, '', to);
    }
    const [pathPart, queryPart] = to.split('?');
    const [pathname, hash] = (pathPart || '/').split('#');
    setLocation({
      pathname,
      search: queryPart ? `?${queryPart}` : '',
      hash: hash ? `#${hash}` : ''
    });
    window.scrollTo(0, 0);
  };

  const value = useMemo(() => ({ location, navigate }), [location]);

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
};

export function useLocation(): Location {
  const ctx = useContext(RouterContext);
  if (!ctx) {
    throw new Error('useLocation must be used within a Router');
  }
  return ctx.location;
}

export function useNavigate(): NavigateFunction {
  const ctx = useContext(RouterContext);
  if (!ctx) {
    throw new Error('useNavigate must be used within a Router');
  }
  return ctx.navigate;
}

interface MatchResult {
  isMatch: boolean;
  params: Record<string, string>;
}

export function matchPath(pattern: string, pathname: string): MatchResult {
  if (pattern === '*' || pattern === '/*') {
    return { isMatch: true, params: {} };
  }

  // Normalize leading and trailing slashes
  const cleanPattern = pattern.replace(/^\/+|\/+$/g, '');
  const cleanPath = pathname.replace(/^\/+|\/+$/g, '');

  if (cleanPattern === cleanPath) {
    return { isMatch: true, params: {} };
  }

  const patternParts = cleanPattern ? cleanPattern.split('/') : [];
  const pathParts = cleanPath ? cleanPath.split('/') : [];

  if (patternParts.length !== pathParts.length) {
    return { isMatch: false, params: {} };
  }

  const params: Record<string, string> = {};

  for (let i = 0; i < patternParts.length; i++) {
    const patternPart = patternParts[i];
    const pathPart = pathParts[i];

    if (patternPart.startsWith(':')) {
      const paramName = patternPart.slice(1);
      params[paramName] = decodeURIComponent(pathPart);
    } else if (patternPart !== pathPart) {
      return { isMatch: false, params: {} };
    }
  }

  return { isMatch: true, params };
}

const ParamsContext = createContext<Record<string, string>>({});

export function useParams<T extends Record<string, string> = Record<string, string>>(): T {
  return useContext(ParamsContext) as T;
}

export interface RouteProps {
  path: string;
  element?: ReactNode;
  component?: ReactNode;
}

export const Route: React.FC<RouteProps> = ({ path, element, component }) => {
  const { pathname } = useLocation();
  const { isMatch, params } = matchPath(path, pathname);

  if (!isMatch) {
    return null;
  }

  return <ParamsContext.Provider value={params}>{element ?? component}</ParamsContext.Provider>;
};

export interface RoutesProps {
  children: ReactNode;
}

export const Routes: React.FC<RoutesProps> = ({ children }) => {
  const { pathname } = useLocation();

  // Find first matching child Route
  const childrenArray = React.Children.toArray(children);
  for (const child of childrenArray) {
    if (React.isValidElement<RouteProps>(child)) {
      const { isMatch, params } = matchPath(child.props.path, pathname);
      if (isMatch) {
        return (
          <ParamsContext.Provider value={params}>
            {child.props.element ?? child.props.component}
          </ParamsContext.Provider>
        );
      }
    }
  }

  return null;
};

export interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  to: string;
  replace?: boolean;
}

export const Link: React.FC<LinkProps> = ({ to, replace, onClick, children, ...rest }) => {
  const navigate = useNavigate();

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (onClick) {
      onClick(e);
    }
    // Only intercept standard left clicks without modifier keys
    if (!e.defaultPrevented && e.button === 0 && !e.metaKey && !e.altKey && !e.ctrlKey && !e.shiftKey) {
      e.preventDefault();
      navigate(to, { replace });
    }
  };

  return (
    <a href={to} onClick={handleClick} {...rest}>
      {children}
    </a>
  );
};
