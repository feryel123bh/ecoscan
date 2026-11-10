import { useEffect, useState } from 'react'

type ApiStatus ='checking' | 'up' | 'down';

/** Step 1: a minimal page that proves the web app can reach the API */
export default function App() {
  const [status, setStatus]= useState<ApiStatus>('checking');

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/v1//health', { signal: controller.signal})
    .then((res) => setStatus(res.ok ? 'up' : 'down'))
    .catch(()=> {
      if (!controller.signal.aborted) setStatus('down');
    });
    return() => controller.abort(); // cancel the request if the page unmounts
  },[]);

  const label ={
    checking: 'Vérification de l API...',
    up :'API opérationnelle',
    down:'API indisponible',
  }[status];

  return(
    <main>
      <h1>EcoScan</h1>
      <p>Mesurez l'empreinte carbonne d'une page web.</p>
      <p role='status' className={`status status-${status}`}>
        {label}
      </p>
    </main>
  );
}
