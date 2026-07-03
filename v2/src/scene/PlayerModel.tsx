import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import type { RefObject } from "react";

interface PlayerModelProps {
  walkingRef: RefObject<boolean>;
}

export function PlayerModel({ walkingRef }: PlayerModelProps) {
  const body = useRef<Group>(null);
  const leftArm = useRef<Group>(null);
  const rightArm = useRef<Group>(null);

  useFrame((state) => {
    const time = state.clock.elapsedTime;
    const stride = walkingRef.current ? Math.sin(time * 10) : 0;
    if (body.current) body.current.position.y = Math.abs(stride) * 0.035;
    if (leftArm.current) leftArm.current.rotation.x = stride * 0.55;
    if (rightArm.current) rightArm.current.rotation.x = -stride * 0.55;
  });

  return (
    <group ref={body}>
      <mesh position={[0, 0.46, 0]} scale={[0.34, 0.48, 0.3]}>
        <sphereGeometry args={[1, 14, 10]} />
        <meshStandardMaterial color="#f7b9a7" flatShading />
      </mesh>
      <mesh position={[0, 0.9, 0]} scale={[0.25, 0.25, 0.25]}>
        <sphereGeometry args={[1, 14, 10]} />
        <meshStandardMaterial color="#f5cbb9" flatShading />
      </mesh>
      <group position={[0, 1.12, 0]}>
        <mesh position={[0, 0, 0]}>
          <cylinderGeometry args={[0.38, 0.38, 0.055, 18]} />
          <meshStandardMaterial color="#f2d27b" flatShading />
        </mesh>
        <mesh position={[0, 0.075, 0]}>
          <cylinderGeometry args={[0.2, 0.27, 0.16, 16]} />
          <meshStandardMaterial color="#e6b85f" flatShading />
        </mesh>
      </group>
      <group ref={leftArm} position={[-0.32, 0.54, 0]} rotation={[0.1, 0, -0.18]}>
        <mesh position={[0, -0.13, 0]}>
          <capsuleGeometry args={[0.045, 0.32, 4, 8]} />
          <meshStandardMaterial color="#f5cbb9" flatShading />
        </mesh>
      </group>
      <group ref={rightArm} position={[0.32, 0.54, 0]} rotation={[0.1, 0, 0.18]}>
        <mesh position={[0, -0.13, 0]}>
          <capsuleGeometry args={[0.045, 0.32, 4, 8]} />
          <meshStandardMaterial color="#f5cbb9" flatShading />
        </mesh>
      </group>
      <mesh position={[-0.11, 0.18, 0.03]} scale={[0.07, 0.18, 0.08]}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshStandardMaterial color="#5b766f" flatShading />
      </mesh>
      <mesh position={[0.11, 0.18, 0.03]} scale={[0.07, 0.18, 0.08]}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshStandardMaterial color="#5b766f" flatShading />
      </mesh>
    </group>
  );
}
