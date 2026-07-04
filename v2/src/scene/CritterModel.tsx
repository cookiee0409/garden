import type { CritterType } from "../game/types";

export function CritterModel({ type }: { type: CritterType }) {
  if (type === "butterfly") {
    return (
      <group>
        <mesh position={[0, 0.34, 0]}>
          <sphereGeometry args={[0.045, 8, 6]} />
          <meshStandardMaterial color="#55423f" />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * 0.08, 0.35, 0]} rotation={[0.15, 0, side * 0.55]} scale={[1.15, 0.7, 0.18]}>
            <sphereGeometry args={[0.12, 12, 8]} />
            <meshStandardMaterial color={side > 0 ? "#f2a2c0" : "#ffd66d"} transparent opacity={0.86} />
          </mesh>
        ))}
      </group>
    );
  }

  if (type === "sparrow") {
    return (
      <group>
        <mesh position={[0, 0.25, 0]}>
          <sphereGeometry args={[0.13, 12, 8]} />
          <meshStandardMaterial color="#9b7657" />
        </mesh>
        <mesh position={[0, 0.36, -0.08]}>
          <sphereGeometry args={[0.08, 10, 8]} />
          <meshStandardMaterial color="#8b674a" />
        </mesh>
        <mesh position={[0, 0.35, -0.17]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.035, 0.08, 8]} />
          <meshStandardMaterial color="#d7a34a" />
        </mesh>
      </group>
    );
  }

  if (type === "rabbit") {
    return (
      <group>
        <mesh position={[0, 0.22, 0]}>
          <sphereGeometry args={[0.16, 12, 8]} />
          <meshStandardMaterial color="#e8dfd5" />
        </mesh>
        <mesh position={[0, 0.4, -0.08]}>
          <sphereGeometry args={[0.1, 10, 8]} />
          <meshStandardMaterial color="#f1e9df" />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * 0.045, 0.55, -0.08]} rotation={[0.18, 0, side * 0.14]} scale={[0.44, 1.25, 0.36]}>
            <sphereGeometry args={[0.08, 10, 8]} />
            <meshStandardMaterial color="#f1e9df" />
          </mesh>
        ))}
      </group>
    );
  }

  if (type === "frog") {
    return (
      <group>
        <mesh position={[0, 0.19, 0]} scale={[1.15, 0.72, 0.95]}>
          <sphereGeometry args={[0.16, 12, 8]} />
          <meshStandardMaterial color="#5fb06a" />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * 0.07, 0.32, -0.08]}>
            <sphereGeometry args={[0.045, 8, 6]} />
            <meshStandardMaterial color="#f6f3d8" />
          </mesh>
        ))}
      </group>
    );
  }

  if (type === "hedgehog") {
    return (
      <group>
        <mesh position={[0, 0.21, 0]} scale={[1.2, 0.8, 0.9]}>
          <sphereGeometry args={[0.17, 12, 8]} />
          <meshStandardMaterial color="#7b5d4b" />
        </mesh>
        {Array.from({ length: 5 }, (_, index) => (
          <mesh key={index} position={[(index - 2) * 0.055, 0.34, 0.03]} rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[0.025, 0.12, 6]} />
            <meshStandardMaterial color="#4d3c35" />
          </mesh>
        ))}
      </group>
    );
  }

  return (
    <group>
      <mesh position={[0, 0.27, 0]}>
        <sphereGeometry args={[0.15, 12, 8]} />
        <meshStandardMaterial color="#7b6a67" />
      </mesh>
      <mesh position={[0, 0.44, -0.05]}>
        <sphereGeometry args={[0.11, 12, 8]} />
        <meshStandardMaterial color="#6f5f5f" />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 0.045, 0.47, -0.15]}>
          <sphereGeometry args={[0.028, 8, 6]} />
          <meshStandardMaterial color="#ffd86f" emissive="#f2bc46" emissiveIntensity={0.45} />
        </mesh>
      ))}
    </group>
  );
}
