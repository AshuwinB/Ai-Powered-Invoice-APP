// import React, { useEffect } from 'react'
// import { useState } from 'react';
// import { setup2fa } from '../service/authApi';

// const TwoFASetup = ({onSetupComplete}) => {

//     const [message, setMessage] = useState('');
//     const [response, setResponse] = useState({});

//     const fetchQRCode = async() => {
//         const data = await setup2fa();
//         console.log(data);
//         setResponse(data);
//     }
    
//     useEffect(() => {
//         fetchQRCode();
//     }, []);

//     const copyClipBoard = async() => {
//         try {
//             await navigator.clipboard.writeText(response.secret); 
//             setMessage('Code copied to clipboard!');
//             setTimeout(() => {
//                 setMessage('');
//             }, 20000);
//         } catch (err) {
//             console.error('Failed to copy text: ', err);
//         }
//     }

//   return (
//         <div className='bg-white rounded-lg shadow-md w-full max-w-sm mx-auto'>
//         <div className='pt-6'>
//             <h2 className='text-3xl text-center font-extralight'>Turn on 2fa Verification</h2>
//         </div>
//     <hr className='text-gray-200 mt-6 mb-6'/>
//     <p className='text-center text-gray-600 text-lg font-light'>Scan the QR code below with your authentication app to enable 2FA.</p>
//     <div className='p-6'>
//         <div className='border-2 border-dashed border-gray-300 rounded-lg p-6 flex justify-center items-center'>
//             <img src={response.qrCode} alt="2fa QR code" className='mb-4 border rounded-md'/>
//         </div>
//         <div className='flex items-center mt-3 mb-3'>
//             <div className='flex grow border-t border-gray-300'></div>
//             <span className='mx-2 text-gray-400'>OR</span>
//             <div className='flex grow border-t border-gray-300'></div>
//         </div>
//         <div className='mb-4'>
//             <label htmlFor="manualCode" className='block text-gray-700 font-medium mb-2'>Enter this code manually in your app:</label>
//             {message && <p className='text-green-500 mb-2'>{message}</p>}
//             <input type="text" id="manualCode" value={response.secret} readOnly className='w-full border border-gray-300 px-3 py-2 rounded-lg mt-1 focus:outline-none focus:border-blue-500 bg-gray-100' onClick={copyClipBoard}/>
//         </div>
//         <button onClick={onSetupComplete} className='mt-6 w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors'>Enable 2FA</button>
//     </div>
//     </div>
//   )
// }

// export default TwoFASetup

import React, { useEffect, useState } from 'react';
import { setup2fa } from '../service/authApi';

const TwoFASetup = ({ onSetupComplete }) => {
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchQRCode = async () => {
      try {
        const data = await setup2fa();
        console.log('2FA SETUP RESPONSE:', data);
        if (!data?.qrCodeDataURL || !data?.secret) {
          throw new Error('Invalid 2FA setup response');
        }

        setQrCode(data.qrCodeDataURL);
        setSecret(data.secret);
      } catch (err) {
        console.error(err);
        setError('Failed to load QR code. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchQRCode();
  }, []);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(secret);
      setMessage('Code copied to clipboard!');
      setTimeout(() => setMessage(''), 4000);
    } catch (err) {
      console.error('Clipboard copy failed:', err);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md w-full max-w-sm mx-auto">
      <div className="pt-6">
        <h2 className="text-3xl text-center font-extralight">
          Turn on 2FA Verification
        </h2>
      </div>

      <hr className="text-gray-200 mt-6 mb-6" />

      {error ? (
        <p className="text-center text-red-500">{error}</p>
      ) : (
        <>
          <p className="text-center text-gray-600 text-lg font-light">
            Scan the QR code below with your authentication app.
          </p>

          <div className="p-6">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 flex justify-center items-center min-h-[200px]">

              {loading ? (
                <p className="text-gray-400">Loading QR Code...</p>
              ) : (
                <img
                  src={qrCode}
                  alt="2FA QR code"
                  className="mb-4 border rounded-md"
                />
              )}

            </div>

            <div className="flex items-center mt-3 mb-3">
              <div className="flex grow border-t border-gray-300"></div>
              <span className="mx-2 text-gray-400">OR</span>
              <div className="flex grow border-t border-gray-300"></div>
            </div>

            <div className="mb-4">
              <label
                htmlFor="manualCode"
                className="block text-gray-700 font-medium mb-2"
              >
                Enter this code manually:
              </label>

              {message && (
                <p className="text-green-500 mb-2">{message}</p>
              )}

              <input
                type="text"
                id="manualCode"
                value={secret}
                readOnly
                className="w-full border border-gray-300 px-3 py-2 rounded-lg mt-1
                           focus:outline-none focus:border-blue-500 bg-gray-100 cursor-pointer"
                onClick={copyToClipboard}
              />
            </div>

            <button
              onClick={onSetupComplete}
              disabled={loading || !secret}
              className={`mt-6 w-full py-2 px-4 rounded-lg transition-colors 
                ${loading || !secret
                  ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-blue-500 text-white hover:bg-blue-600'
                }`}
            >
              Enable 2FA
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default TwoFASetup;
