'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function HomePage() {
const [status, setStatus] = useState("Connecting to Supabase...")

useEffect(() => {
async function testConnection() {
const { data, error } = await supabase
.from('test')
.select('*')

if (error) {
setStatus("❌ Supabase connected but table not created yet")
} else {
setStatus("✅ Supabase is fully connected!")
}
}

testConnection()
}, [])

return (
<main style={{padding:40,fontSize:24}}>
{status}
</main>
)
}
