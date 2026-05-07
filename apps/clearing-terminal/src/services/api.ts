export async function getHealthStatus() {
  const response = await fetch("http://localhost:3000/api/health");

  if (!response.ok) {
    throw new Error("Backend offline");
  }

  return response.json();
}