import React from "react";
import { Box, Typography, ButtonBase, Container } from "@mui/material";

import PhoneIcon from "@mui/icons-material/PhoneIphone";
import TabletIcon from "@mui/icons-material/TabletMac";

const App = () => {
	const accentColor = "#4da6ff";

	const navigate = (route) => {
		window.location.hash = "/" + route;
	};

	return (
		<Box
			sx={{
				height: "100vh",
				display: "flex",
				flexDirection: "column",
				bgcolor: "#1a1a1a",
				color: "white",
				overflow: "hidden",
			}}
		>
			{/* Header Area */}
			<Box sx={{ pt: 4, pb: 2, textAlign: "center", zIndex: 10 }}>
				<Typography variant='h4' sx={{ fontWeight: 800, letterSpacing: "-0.5px" }}>
					Make a photo collage together
				</Typography>
				<Typography variant='body2' sx={{ opacity: 0.5, mt: 1, textTransform: "uppercase", letterSpacing: "1px" }}>
					Choose your role / device
				</Typography>
			</Box>

			{/* Main Buttons Container */}
			<Box sx={{ flexGrow: 1, display: "flex", flexDirection: "column", p: 2, gap: 2 }}>
				{/* Phone / Collaborator (4/5 of the area) */}
				<ButtonBase
					onClick={() => navigate("phone")}
					sx={{
						flex: 4,
						borderRadius: 4,
						bgcolor: accentColor,
						display: "flex",
						flexDirection: "column",
						transition: "transform 0.2s",
						"&:active": { transform: "scale(0.98)" },
						boxShadow: `0 0 30px ${accentColor}44`,
					}}
				>
					<PhoneIcon sx={{ fontSize: 80, mb: 2 }} />
					<Typography variant='h5' sx={{ fontWeight: "bold" }}>
						I am a collaborator
					</Typography>
					<Typography variant='subtitle1'>(Phone)</Typography>
				</ButtonBase>

				{/* Tablet/host (1/5 of the area) */}
				<ButtonBase
					onClick={() => navigate("tablet")}
					sx={{
						flex: 1,
						borderRadius: 4,
						bgcolor: "rgba(255, 255, 255, 0.05)",
						border: "1px solid rgba(255, 255, 255, 0.1)",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						gap: 2,
						"&:hover": { bgcolor: "rgba(255, 255, 255, 0.1)" },
					}}
				>
					<TabletIcon />
					<Box sx={{ textAlign: "left" }}>
						<Typography variant='body1' sx={{ fontWeight: "bold" }}>
							I am the host
						</Typography>
						<Typography variant='caption' sx={{ display: "block", opacity: 0.6 }}>
							(Tablet)
						</Typography>
					</Box>
				</ButtonBase>
			</Box>
		</Box>
	);
};

export default App;
