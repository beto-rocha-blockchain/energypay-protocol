import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

type UserRole =
  | "GENERATOR"
  | "SELLER"
  | "INVESTOR"
  | "CONSUMER";

export const Route = createFileRoute(
  "/register"
)({
  component: RegisterPage,
});

function RegisterPage() {
  const navigate = useNavigate();

  const [loading, setLoading] =
    useState(false);

  const [provisioningStep, setProvisioningStep] =
    useState("");

  const [formData, setFormData] =
    useState({
      full_name: "",
      email: "",

      password: "",

      organization: "",

      country: "",
      city: "",
      state: "",
      address: "",

      has_solar_generation: false,
    });

  const [roles, setRoles] =
    useState<UserRole[]>([]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const {
      name,
      value,
      type,
      checked,
    } = e.target;

    setFormData({
      ...formData,
      [name]:
        type === "checkbox"
          ? checked
          : value,
    });
  };

  const toggleRole = (
    role: UserRole
  ) => {
    if (roles.includes(role)) {
      setRoles(
        roles.filter((r) => r !== role)
      );

      return;
    }

    setRoles([...roles, role]);
  };

  const handleSubmit = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    try {
      if (!roles.length) {
        alert(
          "Select at least one operational role."
        );

        return;
      }

      setLoading(true);

      setProvisioningStep(
        "Creating programmable energy identity..."
      );

      const response = await fetch(
        "http://localhost:3000/api/auth/register",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            ...formData,
            roles,
          }),
        }
      );

      setProvisioningStep(
        "Funding Stellar settlement wallet..."
      );

      const data =
        await response.json();

      if (!data.success) {
        alert(
          data.error ||
            "Registration failed"
        );

        return;
      }

      setProvisioningStep(
        "Connecting operational settlement layer..."
      );

      sessionStorage.setItem(
        "energypay_session",
        JSON.stringify({
          user: data.user,

          wallet: data.wallet,

          roles: data.user.roles,
        })
      );

      setProvisioningStep(
        "Provisioning complete."
      );

      setTimeout(() => {
        alert(
          `Energy Identity Provisioned Successfully

Wallet Address:
${data.wallet.publicKey}

Roles:
${data.user.roles.join(", ")}`
        );

        navigate({
          to: "/",
        });

      }, 1200);

    } catch (error) {
      console.error(error);

      alert(
        "Provisioning failed"
      );

    } finally {
      setLoading(false);
    }
  };

  const roleCardClass = (
    selected: boolean
  ) =>
    `border rounded-2xl p-5 cursor-pointer transition-all duration-300 ${
      selected
        ? "border-cyan-400 bg-cyan-500/10 shadow-[0_0_20px_rgba(34,211,238,0.2)]"
        : "border-white/10 bg-white/5 hover:border-cyan-400/50"
    }`;

  return (
    <div className="min-h-screen bg-[#020617] text-white flex items-center justify-center px-6 py-10">

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.12),transparent_40%)]" />

      <div className="relative w-full max-w-6xl border border-white/10 rounded-3xl bg-white/5 backdrop-blur-xl p-10">

        {/* ===================================== */}
        {/* HEADER */}
        {/* ===================================== */}

        <div className="mb-10">

          <p className="text-cyan-400 text-sm tracking-[0.35em] uppercase mb-3">
            EnergyPay Settlement Network
          </p>

          <h1 className="text-5xl font-bold mb-5 leading-tight">
            Provision Programmable
            Energy Identity
          </h1>

          <p className="text-white/60 max-w-4xl leading-relaxed">
            Create a programmable operational
            identity connected to the Stellar
            settlement layer for energy
            contracts, reconciliation and
            institutional settlement flows.
          </p>

        </div>

        {/* ===================================== */}
        {/* PROVISIONING STATUS */}
        {/* ===================================== */}

        {loading && (
          <div className="mb-8 rounded-2xl border border-cyan-400/20 bg-cyan-500/5 p-6">

            <div className="flex items-center gap-3 mb-3">

              <div className="h-3 w-3 rounded-full bg-cyan-400 animate-pulse" />

              <p className="text-cyan-300 font-semibold">
                Provisioning Energy Identity
              </p>

            </div>

            <p className="text-white/70 text-sm">
              {provisioningStep}
            </p>

          </div>
        )}

        {/* ===================================== */}
        {/* FORM */}
        {/* ===================================== */}

        <form
          onSubmit={handleSubmit}
          className="space-y-10"
        >

          {/* ===================================== */}
          {/* BASIC INFO */}
          {/* ===================================== */}

          <div>

            <div className="mb-5">
              <h2 className="text-2xl font-semibold mb-2">
                Identity Information
              </h2>

              <p className="text-white/50 text-sm">
                Configure institutional
                onboarding information and
                settlement identity metadata.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              <div>
                <label className="text-sm text-white/60 block mb-2">
                  Full Name
                </label>

                <input
                  type="text"
                  name="full_name"
                  required
                  value={
                    formData.full_name
                  }
                  onChange={handleChange}
                  className="w-full rounded-xl bg-black/30 border border-white/10 px-4 py-3 outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="text-sm text-white/60 block mb-2">
                  Email
                </label>

                <input
                  type="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full rounded-xl bg-black/30 border border-white/10 px-4 py-3 outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="text-sm text-white/60 block mb-2">
                  Password
                </label>

                <input
                  type="password"
                  name="password"
                  required
                  value={
                    formData.password
                  }
                  onChange={handleChange}
                  className="w-full rounded-xl bg-black/30 border border-white/10 px-4 py-3 outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="text-sm text-white/60 block mb-2">
                  Organization
                </label>

                <input
                  type="text"
                  name="organization"
                  value={
                    formData.organization
                  }
                  onChange={handleChange}
                  className="w-full rounded-xl bg-black/30 border border-white/10 px-4 py-3 outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="text-sm text-white/60 block mb-2">
                  Country
                </label>

                <input
                  type="text"
                  name="country"
                  value={
                    formData.country
                  }
                  onChange={handleChange}
                  className="w-full rounded-xl bg-black/30 border border-white/10 px-4 py-3 outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="text-sm text-white/60 block mb-2">
                  City
                </label>

                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  className="w-full rounded-xl bg-black/30 border border-white/10 px-4 py-3 outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="text-sm text-white/60 block mb-2">
                  State
                </label>

                <input
                  type="text"
                  name="state"
                  value={formData.state}
                  onChange={handleChange}
                  className="w-full rounded-xl bg-black/30 border border-white/10 px-4 py-3 outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="text-sm text-white/60 block mb-2">
                  Address
                </label>

                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  className="w-full rounded-xl bg-black/30 border border-white/10 px-4 py-3 outline-none focus:border-cyan-400"
                />
              </div>

            </div>

          </div>

          {/* ===================================== */}
          {/* ROLES */}
          {/* ===================================== */}

          <div>

            <div className="mb-5">

              <h2 className="text-2xl font-semibold mb-2">
                Operational Capabilities
              </h2>

              <p className="text-white/50 text-sm">
                Multiple operational
                permissions can be linked
                to the same programmable
                energy identity.
              </p>

            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

              {/* GENERATOR */}

              <div
                onClick={() =>
                  toggleRole(
                    "GENERATOR"
                  )
                }
                className={roleCardClass(
                  roles.includes(
                    "GENERATOR"
                  )
                )}
              >
                <h3 className="font-semibold text-xl mb-3">
                  Generator
                </h3>

                <p className="text-sm text-white/60 leading-relaxed">
                  Connect smart meters,
                  validate telemetry and
                  issue programmable
                  settlement assets linked
                  to energy generation.
                </p>

              </div>

              {/* SELLER */}

              <div
                onClick={() =>
                  toggleRole(
                    "SELLER"
                  )
                }
                className={roleCardClass(
                  roles.includes(
                    "SELLER"
                  )
                )}
              >
                <h3 className="font-semibold text-xl mb-3">
                  Seller
                </h3>

                <p className="text-sm text-white/60 leading-relaxed">
                  Manage bilateral energy
                  contracts, reconciliation
                  flows and settlement
                  execution.
                </p>

              </div>

              {/* INVESTOR */}

              <div
                onClick={() =>
                  toggleRole(
                    "INVESTOR"
                  )
                }
                className={roleCardClass(
                  roles.includes(
                    "INVESTOR"
                  )
                )}
              >
                <h3 className="font-semibold text-xl mb-3">
                  Investor
                </h3>

                <p className="text-sm text-white/60 leading-relaxed">
                  Monitor energy-backed
                  operational exposure,
                  liquidity and settlement
                  infrastructure metrics.
                </p>

              </div>

              {/* CONSUMER */}

              <div
                onClick={() =>
                  toggleRole(
                    "CONSUMER"
                  )
                }
                className={roleCardClass(
                  roles.includes(
                    "CONSUMER"
                  )
                )}
              >
                <h3 className="font-semibold text-xl mb-3">
                  User / Consumer
                </h3>

                <p className="text-sm text-white/60 leading-relaxed">
                  Acquire energy, monitor
                  settlement provenance and
                  validate operational
                  delivery flows.
                </p>

              </div>

            </div>

          </div>

          {/* ===================================== */}
          {/* SOLAR */}
          {/* ===================================== */}

          <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-5">

            <input
              type="checkbox"
              name="has_solar_generation"
              checked={
                formData.has_solar_generation
              }
              onChange={handleChange}
              className="h-5 w-5"
            />

            <div>
              <p className="font-medium">
                Photovoltaic Generation
              </p>

              <p className="text-sm text-white/50">
                Enable telemetry-based
                settlement provisioning for
                distributed energy generation.
              </p>
            </div>

          </div>

          {/* ===================================== */}
          {/* FOOTER */}
          {/* ===================================== */}

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 pt-8 border-t border-white/10">

            <div>

              <p className="text-sm text-white/40 mb-2">
                Selected Operational Roles
              </p>

              <p className="text-cyan-400 font-semibold">
                {roles.length
                  ? roles.join(", ")
                  : "NONE"}
              </p>

            </div>

            <button
              type="submit"
              disabled={loading}
              className="px-10 py-4 rounded-2xl bg-cyan-500 hover:bg-cyan-400 transition-all font-semibold text-black disabled:opacity-50"
            >
              {loading
                ? "Provisioning..."
                : "Provision Energy Identity"}
            </button>

          </div>

        </form>

      </div>
    </div>
  );
}