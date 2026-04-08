import { RouterProvider } from 'react-router-dom'
import './App.css'
import { router } from './routes.jsx'
import { SessionProvider } from './context/SessionContext.jsx'

function App() {


  return (
    <>
      <div className="app-shell min-h-screen">
        <SessionProvider>
          <RouterProvider
            router={router}
          />
        </SessionProvider>
      </div>
    </>
  )
}

export default App
