import { createBrowserRouter } from "react-router-dom";
import { RequireAuth } from "./auth/RequireAuth";
import { AppShell } from "./components/AppShell";
import LoginPage from "./pages/LoginPage";
import HomePage from "./pages/HomePage";
import AddSeasoningPage from "./pages/AddSeasoningPage";
import EditSeasoningPage from "./pages/EditSeasoningPage";
import AmountChangePage from "./pages/AmountChangePage";
import ShoppingListPage from "./pages/ShoppingListPage";

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: "/", element: <HomePage /> },
          { path: "/seasonings/new", element: <AddSeasoningPage /> },
          { path: "/seasonings/:id/edit", element: <EditSeasoningPage /> },
          { path: "/seasonings/:id/amount", element: <AmountChangePage /> },
          { path: "/shopping-list", element: <ShoppingListPage /> },
        ],
      },
    ],
  },
]);
