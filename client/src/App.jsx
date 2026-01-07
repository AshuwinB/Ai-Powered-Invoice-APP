import { RouterProvider } from 'react-router-dom'
import './App.css'
import { router } from './routes.jsx'
import { SessionProvider } from './context/SessionContext.jsx'

function App() {


  return (
    <>
      <div className="bg-slate-100 h-screen">
        <div className='flex justify-center items-center h-screen'>
          <SessionProvider>
          <RouterProvider 
            router={router}
          />
          </SessionProvider>
        </div>
      </div>
    </>
  )
}

export default App
