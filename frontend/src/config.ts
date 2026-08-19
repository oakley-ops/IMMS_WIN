// Get API URL from environment or use default
const getApiUrl = () => {
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  // Production: use relative URLs so the frontend calls the same server that served it
  if (process.env.NODE_ENV === 'production') {
    return '';
  }
  return 'http://localhost:4000';
};

export const API_URL = getApiUrl();
console.log('Environment:', process.env.NODE_ENV);
console.log('API URL:', API_URL);

// Server-relative asset paths (e.g. part image `/uploads/part_images/...`) are
// stored relative in the DB. The page serving the frontend isn't necessarily
// the API origin (dev's CRA server vs. the :4100 API, prod's standalone
// static-serve vs. the :4000 API), so resolve them against API_URL instead of
// leaving the browser to fetch them from whatever origin rendered the page.
export const resolveAssetUrl = (url?: string | null): string | undefined => {
  if (!url) return undefined;
  if (/^(https?:)?\/\//i.test(url) || url.startsWith('data:') || url.startsWith('blob:')) {
    return url;
  }
  return `${API_URL}${url}`;
};