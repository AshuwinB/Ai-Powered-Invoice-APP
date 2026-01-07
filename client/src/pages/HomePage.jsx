import React from 'react'
import {useNavigate} from 'react-router-dom'
import { useSessionContext } from '../context/SessionContext';
import { logoutUser } from '../service/authApi';

const HomePage = () => {
  const navigate = useNavigate();
  const {user, logout} = useSessionContext();

  const handleLogout = async () => {
    try {
      const data = await logoutUser();
      logout(data);
      navigate('/login');
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  console.log("User data in HomePage:", user);
  return (
    <div className='p-6 bg-white rounded-lg shadow-md max-w-md mx-auto mt-10'>
      <h2 className='text-xl font-semibold mb-4'>Welcome, {user.user}</h2>
      <p className='text-gray-600 mb-6'>You have successfully logged in.</p>
      <button onClick={handleLogout} className='w-full bg-red-500 text-white py-2 rounded-lg hover:bg-red-600 transition-colors'>
        Logout
      </button>
    </div>
  )
}

export default HomePage