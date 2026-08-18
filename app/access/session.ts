export async function accessConfiguration() {
  return {
    accessCode: "",
    sessionSecret: "",
    configured: false,
    derivedFromAdminPassword: false,
  };
}
