import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("AdminBundleModule", (m) => {
  //Deploy the admin level contracts
  const roles = m.contract("Roles");
  const reputation = m.contract("Reputation", [roles]);

  return { roles, reputation };
});
