// src/reportWebVitals.ts

const reportWebVitals = (onPerfEntry?: (metric: any) => void) => {
  if (onPerfEntry && onPerfEntry instanceof Function) {
    import('web-vitals').then((vitals: any) => { // Explicitly type vitals as any
      vitals.getCLS(onPerfEntry);
      vitals.getFID(onPerfEntry);
      vitals.getFCP(onPerfEntry);
      vitals.getLCP(onPerfEntry);
      vitals.getTTFB(onPerfEntry);
    });
  }
};

export default reportWebVitals;