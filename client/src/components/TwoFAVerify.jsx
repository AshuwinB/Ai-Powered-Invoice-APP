// import React from 'react'
// import { useState } from 'react';
// import { verify2fa } from '../service/authApi'
// import { reset2fa } from '../service/authApi'

// const TwoFAVerify = ({onVerifySuccess, onResetSuccess}) => {

//     const [otp, setOtp] = useState('');
//     const [error, setError] = useState('');

//     const handleTokenVerification = async (e) => {
//         e.preventDefault();
//         try {
//             console.log('Verifying OTP:', otp);
//             const data = await verify2fa(token);
//             console.log(data)
//             if(otp == data){
//                 onVerifySuccess(data);
//             } else {
//                 setOtp("");
//                 setError('Invalid OTP. Please try again.');
//             }
//         } catch (err) {
//             setOtp("")
//             console.error(err);
//             setError('Verification failed. Please try again.');
//         }
//     };

//     const handleReset = async () => {
//         try {
//             const {data} = await reset2fa();
//             console.log('2FA RESET RESPONSE:', data);
//             if(data && data.success){
//                 onResetSuccess(data);
//             }
//         } catch (err) {
//             console.error(err);
//             setError('2FA reset failed. Please try again.');
//         }
//     }
    

//   return (
//     <form action="" onSubmit={handleTokenVerification} className='bg-white rounded-lg shadow-md w-full max-w-sm mx-auto'>
//         <div className='pt-6'>
//             <h2 className='text-3xl text-center font-extralight'>Validate Token OTP</h2>
//         </div>
//     <hr className='text-gray-200 mt-6 mb-6'/>
//     <p className='text-center text-gray-600 text-lg font-light'>Please Enter 6-digit Time based OTP to verify 2fa authentication</p>
//     <div className='p-6'>
//         <div className='mb-4'>
//             <label className='text-gray-600 text-sm'>TOTP</label>
//             <input value={otp} onChange = {(e) => setOtp(e.target.value)} label="TOTP" type='text' className='w-full border border-gray-300 px-3 py-2 rounded-lg mt-1 focus:outline-none focus:border-blue-500' required/>
//         </div>  
//         {error && <p className='text-red-500 text-sm mb-4'>{error}</p>}
//         <button type='submit' className='w-full bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 transition-colors'>Verify TOTP</button>
//     <div className='mt-4 text-center'>
//         <button type='button' onClick={handleReset} className='w-full bg-red-500 text-white py-2 rounded-lg hover:bg-red-600 transition-colors'>Reset 2FA</button>
//     </div>
//     </div>
//     </form>
//   )
// }

// export default TwoFAVerify


import React, { useState } from 'react';
import { verify2fa, reset2fa } from '../service/authApi';

const TwoFAVerify = ({ onVerifySuccess, onResetSuccess }) => {
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');

  const handleTokenVerification = async (e) => {
    e.preventDefault();
    try {
      console.log('Verifying OTP:', otp);

      // FIXED: pass otp, not token
      const data = await verify2fa(otp);

      console.log("verify2fa response:", data);

      // FIXED: check correct response structure
      if (data.jwtToken) {
        onVerifySuccess(data);
      } else {
        setError('Invalid OTP. Please try again.');
        setOtp('');
      }
    } catch (err) {
      console.error(err);
      setError('Verification failed. Please try again.');
      setOtp('');
    }
  };

  const handleReset = async () => {
    try {
      // FIXED: reset2fa() already returns data
      const data = await reset2fa();

      console.log('2FA RESET RESPONSE:', data);

      if (data) {
        onResetSuccess(data);
      } else {
        setError("2FA reset failed.");
      }
    } catch (err) {
      console.error(err);
      setError('2FA reset failed. Please try again.');
    }
  };

  return (
    <form onSubmit={handleTokenVerification} className="bg-white rounded-lg shadow-md w-full max-w-sm mx-auto">
      <div className="pt-6">
        <h2 className="text-3xl text-center font-extralight">Validate Token OTP</h2>
      </div>

      <hr className="text-gray-200 mt-6 mb-6" />

      <p className="text-center text-gray-600 text-lg font-light">
        Please enter the 6-digit TOTP to verify 2FA authentication.
      </p>

      <div className="p-6">
        <div className="mb-4">
          <label className="text-gray-600 text-sm">TOTP</label>
          <input
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            type="text"
            className="w-full border border-gray-300 px-3 py-2 rounded-lg mt-1 focus:outline-none focus:border-blue-500"
            required
          />
        </div>

        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

        <button type="submit" className="w-full bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 transition-colors">
          Verify TOTP
        </button>

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={handleReset}
            className="w-full bg-red-500 text-white py-2 rounded-lg hover:bg-red-600 transition-colors"
          >
            Reset 2FA
          </button>
        </div>
      </div>
    </form>
  );
};

export default TwoFAVerify;
