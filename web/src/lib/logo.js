let logoDataUrlCache = null;

export async function logoDataUrl() {
    if (logoDataUrlCache !== null) {
        return logoDataUrlCache;
    }
    try {
        const respuesta = await fetch('/logo-galileo-monocromo.png');
        const blob = await respuesta.blob();
        logoDataUrlCache = await new Promise((resolve, reject) => {
            const lector = new FileReader();
            lector.onload = () => resolve(lector.result);
            lector.onerror = () => reject(new Error('No se pudo cargar el logo.'));
            lector.readAsDataURL(blob);
        });
    } catch {
        logoDataUrlCache = '';
    }
    return logoDataUrlCache;
}
