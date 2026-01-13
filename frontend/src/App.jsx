import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import AirlineBookingSystem from './component/AirlineBookingSystem'
import React from 'react'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <AirlineBookingSystem></AirlineBookingSystem>
    </>
  )
}

export default App
