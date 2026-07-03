import type { GrowthStage } from "../game/types";

interface CropModelProps {
  type: string;
  stage: GrowthStage;
  wilted: boolean;
}

const WILTED_FOLIAGE = "#8a7a5e";
const WILTED_FRUIT = "#a08a6a";

function Sprout({ wilted }: { wilted: boolean }) {
  const leaf = wilted ? WILTED_FOLIAGE : "#8fd16e";
  return (
    <group>
      <mesh position={[0, 0.12, 0]}>
        <cylinderGeometry args={[0.025, 0.035, 0.2, 6]} />
        <meshStandardMaterial color={wilted ? WILTED_FOLIAGE : "#65b95f"} />
      </mesh>
      <mesh position={[-0.07, 0.24, 0]} rotation={[0, 0, 0.6]}>
        <sphereGeometry args={[0.07, 8, 6]} />
        <meshStandardMaterial color={leaf} />
      </mesh>
      <mesh position={[0.07, 0.24, 0]} rotation={[0, 0, -0.6]}>
        <sphereGeometry args={[0.07, 8, 6]} />
        <meshStandardMaterial color={leaf} />
      </mesh>
    </group>
  );
}

function TomatoPlant({ mature, wilted }: { mature: boolean; wilted: boolean }) {
  const bush = wilted ? WILTED_FOLIAGE : "#4faa5e";
  const fruit = wilted ? WILTED_FRUIT : "#e95a5f";
  const fruitPositions: [number, number, number][] = mature
    ? [
        [0.16, 0.38, 0.14],
        [-0.18, 0.3, 0.08],
        [0.02, 0.24, 0.22],
      ]
    : [[0.12, 0.3, 0.14]];
  return (
    <group>
      <mesh position={[0, 0.32, 0]}>
        <sphereGeometry args={[0.3, 10, 8]} />
        <meshStandardMaterial color={bush} flatShading />
      </mesh>
      {fruitPositions.map((position, index) => (
        <mesh key={index} position={position}>
          <sphereGeometry args={[0.08, 8, 6]} />
          <meshStandardMaterial color={fruit} />
        </mesh>
      ))}
    </group>
  );
}

function CarrotPlant({ mature, wilted }: { mature: boolean; wilted: boolean }) {
  return (
    <group>
      <mesh position={[0, 0.32, 0]}>
        <coneGeometry args={[0.18, 0.4, 7]} />
        <meshStandardMaterial color={wilted ? WILTED_FOLIAGE : "#65b95f"} flatShading />
      </mesh>
      {mature && (
        <mesh position={[0, 0.08, 0]}>
          <cylinderGeometry args={[0.09, 0.05, 0.14, 8]} />
          <meshStandardMaterial color={wilted ? WILTED_FRUIT : "#f18842"} />
        </mesh>
      )}
    </group>
  );
}

function StrawberryPlant({ mature, wilted }: { mature: boolean; wilted: boolean }) {
  const bush = wilted ? WILTED_FOLIAGE : "#69bf75";
  const fruit = wilted ? WILTED_FRUIT : "#df5271";
  const fruitPositions: [number, number, number][] = mature
    ? [
        [0.2, 0.1, 0.14],
        [-0.2, 0.1, 0.1],
        [0.02, 0.1, 0.24],
      ]
    : [[0.16, 0.1, 0.12]];
  return (
    <group>
      <mesh position={[0, 0.2, 0]} scale={[1, 0.72, 1]}>
        <sphereGeometry args={[0.26, 10, 8]} />
        <meshStandardMaterial color={bush} flatShading />
      </mesh>
      {fruitPositions.map((position, index) => (
        <mesh key={index} position={position}>
          <sphereGeometry args={[0.075, 8, 6]} />
          <meshStandardMaterial color={fruit} />
        </mesh>
      ))}
    </group>
  );
}

function SunflowerPlant({ mature, wilted }: { mature: boolean; wilted: boolean }) {
  return (
    <group>
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.03, 0.045, 0.6, 6]} />
        <meshStandardMaterial color={wilted ? WILTED_FOLIAGE : "#419b5a"} />
      </mesh>
      <mesh position={[0, 0.62, 0]}>
        <sphereGeometry args={[mature ? 0.17 : 0.12, 10, 8]} />
        <meshStandardMaterial color={wilted ? WILTED_FRUIT : "#f2c94c"} flatShading />
      </mesh>
      {mature && (
        <mesh position={[0, 0.62, 0.13]}>
          <sphereGeometry args={[0.08, 8, 6]} />
          <meshStandardMaterial color="#7d5638" />
        </mesh>
      )}
    </group>
  );
}

function WatermelonPlant({ mature, wilted }: { mature: boolean; wilted: boolean }) {
  return (
    <group>
      <mesh position={[-0.2, 0.1, -0.16]} scale={[1, 0.6, 1]}>
        <sphereGeometry args={[0.14, 8, 6]} />
        <meshStandardMaterial color={wilted ? WILTED_FOLIAGE : "#69bf75"} flatShading />
      </mesh>
      <mesh position={[0.06, mature ? 0.19 : 0.12, 0.05]} scale={[1, 0.78, 1]}>
        <sphereGeometry args={[mature ? 0.26 : 0.16, 10, 8]} />
        <meshStandardMaterial color={wilted ? WILTED_FRUIT : "#2f9b66"} flatShading />
      </mesh>
    </group>
  );
}

function MoonMushroomPlant({ mature, wilted }: { mature: boolean; wilted: boolean }) {
  const stem = wilted ? WILTED_FOLIAGE : "#d9d3c2";
  const cap = wilted ? WILTED_FRUIT : "#8bb7ff";
  return (
    <group>
      <mesh position={[0, 0.18, 0]}>
        <cylinderGeometry args={[0.07, 0.1, mature ? 0.36 : 0.24, 8]} />
        <meshStandardMaterial color={stem} />
      </mesh>
      <mesh position={[0, mature ? 0.42 : 0.3, 0]} scale={[1.15, 0.58, 1.15]}>
        <sphereGeometry args={[mature ? 0.24 : 0.16, 12, 8]} />
        <meshStandardMaterial color={cap} emissive={wilted ? "#000000" : "#5b88e8"} emissiveIntensity={mature && !wilted ? 0.45 : 0.15} />
      </mesh>
      {mature && (
        <mesh position={[0.16, 0.3, 0.08]} scale={[0.72, 0.5, 0.72]}>
          <sphereGeometry args={[0.11, 10, 8]} />
          <meshStandardMaterial color={wilted ? WILTED_FRUIT : "#c8ddff"} emissive={wilted ? "#000000" : "#6ca5ff"} emissiveIntensity={0.22} />
        </mesh>
      )}
    </group>
  );
}

function RainbowFlowerPlant({ mature, wilted }: { mature: boolean; wilted: boolean }) {
  const colors = wilted ? [WILTED_FRUIT, WILTED_FRUIT, WILTED_FRUIT, WILTED_FRUIT, WILTED_FRUIT, WILTED_FRUIT] : ["#ef6d79", "#f3b34c", "#f1df64", "#69bf75", "#69a7ee", "#a982dd"];
  return (
    <group>
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.026, 0.04, mature ? 0.62 : 0.42, 6]} />
        <meshStandardMaterial color={wilted ? WILTED_FOLIAGE : "#4f9f5c"} />
      </mesh>
      {colors.map((color, index) => {
        const angle = (index / colors.length) * Math.PI * 2;
        const radius = mature ? 0.16 : 0.1;
        return (
          <mesh key={index} position={[Math.cos(angle) * radius, mature ? 0.64 : 0.48, Math.sin(angle) * radius]} scale={[1, 0.62, 1]}>
            <sphereGeometry args={[mature ? 0.1 : 0.07, 10, 8]} />
            <meshStandardMaterial color={color} />
          </mesh>
        );
      })}
      <mesh position={[0, mature ? 0.64 : 0.48, 0]}>
        <sphereGeometry args={[mature ? 0.08 : 0.06, 10, 8]} />
        <meshStandardMaterial color={wilted ? WILTED_FRUIT : "#f7e28f"} />
      </mesh>
    </group>
  );
}

export function CropModel({ type, stage, wilted }: CropModelProps) {
  if (stage === "sprout") return <Sprout wilted={wilted} />;

  const mature = stage === "ready";
  const scale = mature ? 1 : 0.72;
  let plant = null;
  if (type === "tomato") plant = <TomatoPlant mature={mature} wilted={wilted} />;
  else if (type === "carrot") plant = <CarrotPlant mature={mature} wilted={wilted} />;
  else if (type === "strawberry") plant = <StrawberryPlant mature={mature} wilted={wilted} />;
  else if (type === "sunflower") plant = <SunflowerPlant mature={mature} wilted={wilted} />;
  else if (type === "watermelon") plant = <WatermelonPlant mature={mature} wilted={wilted} />;
  else if (type === "moon_mushroom") plant = <MoonMushroomPlant mature={mature} wilted={wilted} />;
  else if (type === "rainbow_flower") plant = <RainbowFlowerPlant mature={mature} wilted={wilted} />;
  else plant = <Sprout wilted={wilted} />;

  return <group scale={scale}>{plant}</group>;
}
