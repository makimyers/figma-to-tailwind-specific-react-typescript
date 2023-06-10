import React from 'react';
import { Route, createBrowserRouter, createRoutesFromElements, RouterProvider } from 'react-router-dom';
import FigmaToTailwind from './pages/App';

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route path='/*' element={<FigmaToTailwind />} />
  )
)

function App() {
  return (
    <>
      <RouterProvider router={router} />
    </>
  );
}

export default App;