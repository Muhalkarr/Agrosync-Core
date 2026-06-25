-- phpMyAdmin SQL Dump
-- version 5.2.2
-- https://www.phpmyadmin.net/
--
-- Host: localhost:3306
-- Waktu pembuatan: 21 Jun 2026 pada 01.49
-- Versi server: 10.6.25-MariaDB-cll-lve
-- Versi PHP: 8.4.21

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `analyzer_agrosync_local`
--

-- --------------------------------------------------------

--
-- Struktur dari tabel `visi_edge`
--

CREATE TABLE `visi_edge` (
  `id` bigint(20) NOT NULL,
  `waktu_tangkap` timestamp NOT NULL DEFAULT current_timestamp(),
  `file_path` varchar(255) NOT NULL,
  `file_size_kb` int(11) NOT NULL,
  `ai_status` enum('PENDING','PROCESSED','FAILED') DEFAULT 'PENDING',
  `ai_confidence` decimal(5,2) DEFAULT NULL,
  `manual_label` enum('UNLABELED','HAMA','NORMAL','BURAM') DEFAULT 'UNLABELED',
  `image_url` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data untuk tabel `visi_edge`
--

INSERT INTO `visi_edge` (`id`, `waktu_tangkap`, `file_path`, `file_size_kb`, `ai_status`, `ai_confidence`, `manual_label`, `image_url`) VALUES
(1, '2026-05-14 17:23:51', '/uploads/edge_vision_1778779431186.jpg', 20, 'PENDING', NULL, 'UNLABELED', '/uploads/edge_vision_1778779431186.jpg'),
(2, '2026-05-14 17:26:50', '/uploads/edge_vision_1778779610764.jpg', 20, 'PENDING', NULL, 'UNLABELED', '/uploads/edge_vision_1778779610764.jpg'),
(3, '2026-05-14 18:02:57', '/uploads/edge_vision_1778781777601.jpg', 17, 'PENDING', NULL, 'UNLABELED', '/uploads/edge_vision_1778781777601.jpg'),
(4, '2026-05-14 18:03:45', '/uploads/edge_vision_1778781825309.jpg', 17, 'PENDING', NULL, 'UNLABELED', '/uploads/edge_vision_1778781825309.jpg'),
(5, '2026-05-14 18:04:37', '/uploads/edge_vision_1778781877355.jpg', 17, 'PENDING', NULL, 'UNLABELED', '/uploads/edge_vision_1778781877355.jpg'),
(6, '2026-05-14 18:23:47', '/uploads/edge_vision_1778783027738.jpg', 16, 'PENDING', NULL, 'UNLABELED', '/uploads/edge_vision_1778783027738.jpg'),
(7, '2026-05-14 18:24:01', '/uploads/edge_vision_1778783041513.jpg', 22, 'PENDING', NULL, 'UNLABELED', '/uploads/edge_vision_1778783041513.jpg'),
(8, '2026-05-14 18:24:42', '/uploads/edge_vision_1778783082264.jpg', 17, 'PENDING', NULL, 'UNLABELED', '/uploads/edge_vision_1778783082264.jpg'),
(9, '2026-05-14 18:27:02', '/uploads/edge_vision_1778783222168.jpg', 41, 'PENDING', NULL, 'UNLABELED', '/uploads/edge_vision_1778783222168.jpg'),
(10, '2026-05-14 18:27:38', '/uploads/edge_vision_1778783258518.jpg', 14, 'PENDING', NULL, 'UNLABELED', '/uploads/edge_vision_1778783258518.jpg'),
(11, '2026-05-14 19:00:37', '/uploads/edge_vision_1778785237745.jpg', 25, 'PENDING', NULL, 'UNLABELED', '/uploads/edge_vision_1778785237745.jpg'),
(12, '2026-05-14 19:00:52', '/uploads/edge_vision_1778785252747.jpg', 25, 'PENDING', NULL, 'UNLABELED', '/uploads/edge_vision_1778785252747.jpg'),
(13, '2026-05-14 21:18:43', '/uploads/edge_vision_1778793520320.jpg', 19, 'PENDING', NULL, 'UNLABELED', '/uploads/edge_vision_1778793520320.jpg'),
(14, '2026-05-14 21:19:42', '/uploads/edge_vision_1778793581734.jpg', 24, 'PENDING', NULL, 'UNLABELED', '/uploads/edge_vision_1778793581734.jpg'),
(15, '2026-05-14 21:21:14', '/uploads/edge_vision_1778793674146.jpg', 23, 'PENDING', NULL, 'UNLABELED', '/uploads/edge_vision_1778793674146.jpg'),
(16, '2026-05-14 21:23:18', '/uploads/edge_vision_1778793798824.jpg', 16, 'PENDING', NULL, 'UNLABELED', '/uploads/edge_vision_1778793798824.jpg'),
(17, '2026-05-14 21:23:43', '/uploads/edge_vision_1778793823115.jpg', 21, 'PENDING', NULL, 'UNLABELED', '/uploads/edge_vision_1778793823115.jpg'),
(18, '2026-05-14 21:24:16', '/uploads/edge_vision_1778793856724.jpg', 21, 'PENDING', NULL, 'UNLABELED', '/uploads/edge_vision_1778793856724.jpg'),
(19, '2026-05-14 21:38:05', '/uploads/edge_vision_1778794685029.jpg', 22, 'PENDING', NULL, 'UNLABELED', '/uploads/edge_vision_1778794685029.jpg'),
(20, '2026-05-15 02:43:38', '/uploads/edge_vision_1778813018957.jpg', 23, 'PENDING', NULL, 'UNLABELED', '/uploads/edge_vision_1778813018957.jpg'),
(21, '2026-05-15 02:44:52', '/uploads/edge_vision_1778813092007.jpg', 26, 'PENDING', NULL, 'UNLABELED', '/uploads/edge_vision_1778813092007.jpg'),
(22, '2026-05-16 04:58:19', '/uploads/edge_vision_1778907499758.jpg', 22, 'PENDING', NULL, 'UNLABELED', '/uploads/edge_vision_1778907499758.jpg'),
(23, '2026-05-16 05:00:44', '/uploads/edge_vision_1778907644779.jpg', 23, 'PENDING', NULL, 'UNLABELED', '/uploads/edge_vision_1778907644779.jpg'),
(24, '2026-05-16 05:34:04', '/uploads/edge_vision_1778909644086.jpg', 23, 'PENDING', NULL, 'UNLABELED', '/uploads/edge_vision_1778909644086.jpg'),
(25, '2026-05-16 05:34:22', '/uploads/edge_vision_1778909662808.jpg', 23, 'PENDING', NULL, 'UNLABELED', '/uploads/edge_vision_1778909662808.jpg'),
(26, '2026-05-16 06:06:23', '/uploads/edge_vision_1778911583525.jpg', 23, 'PENDING', NULL, 'UNLABELED', '/uploads/edge_vision_1778911583525.jpg'),
(27, '2026-05-16 06:12:25', '/uploads/edge_vision_1778911945013.jpg', 23, 'PENDING', NULL, 'UNLABELED', '/uploads/edge_vision_1778911945013.jpg'),
(28, '2026-05-16 06:50:45', '/uploads/edge_vision_1778914245626.jpg', 23, 'PENDING', NULL, 'UNLABELED', '/uploads/edge_vision_1778914245626.jpg'),
(29, '2026-05-16 06:51:09', '/uploads/edge_vision_1778914269543.jpg', 23, 'PENDING', NULL, 'UNLABELED', '/uploads/edge_vision_1778914269543.jpg'),
(30, '2026-05-16 07:13:15', '/uploads/edge_vision_1778915595927.jpg', 21, 'PENDING', NULL, 'UNLABELED', '/uploads/edge_vision_1778915595927.jpg'),
(31, '2026-05-16 07:55:41', '/uploads/edge_vision_1778918141378.jpg', 29, 'PENDING', NULL, 'UNLABELED', '/uploads/edge_vision_1778918141378.jpg'),
(32, '2026-05-16 07:56:11', '/uploads/edge_vision_1778918171547.jpg', 25, 'PENDING', NULL, 'UNLABELED', '/uploads/edge_vision_1778918171547.jpg'),
(33, '2026-05-16 07:56:31', '/uploads/edge_vision_1778918191655.jpg', 28, 'PENDING', NULL, 'UNLABELED', '/uploads/edge_vision_1778918191655.jpg'),
(34, '2026-05-16 07:57:46', '/uploads/edge_vision_1778918266781.jpg', 30, 'PENDING', NULL, 'NORMAL', '/uploads/edge_vision_1778918266781.jpg'),
(35, '2026-05-16 08:16:08', '/uploads/edge_vision_1778919368609.jpg', 17, 'PENDING', NULL, 'UNLABELED', '/uploads/edge_vision_1778919368609.jpg'),
(36, '2026-05-16 08:16:18', '/uploads/edge_vision_1778919378715.jpg', 30, 'PENDING', NULL, 'UNLABELED', '/uploads/edge_vision_1778919378715.jpg'),
(37, '2026-05-16 08:16:32', '/uploads/edge_vision_1778919392672.jpg', 30, 'PENDING', NULL, 'UNLABELED', '/uploads/edge_vision_1778919392672.jpg'),
(38, '2026-05-16 08:16:48', '/uploads/edge_vision_1778919408433.jpg', 30, 'PENDING', NULL, 'UNLABELED', '/uploads/edge_vision_1778919408433.jpg'),
(39, '2026-05-16 08:17:34', '/uploads/edge_vision_1778919454049.jpg', 27, 'PENDING', NULL, 'UNLABELED', '/uploads/edge_vision_1778919454049.jpg'),
(40, '2026-05-16 10:23:20', '/uploads/edge_vision_1778927000218.jpg', 16, 'PENDING', NULL, 'UNLABELED', '/uploads/edge_vision_1778927000218.jpg'),
(41, '2026-05-16 10:50:00', '/uploads/edge_vision_1778928600200.jpg', 33, 'PENDING', NULL, 'UNLABELED', '/uploads/edge_vision_1778928600200.jpg'),
(42, '2026-05-16 11:07:07', '/uploads/edge_vision_1778929627936.jpg', 28, 'PENDING', NULL, 'UNLABELED', '/uploads/edge_vision_1778929627936.jpg'),
(43, '2026-05-16 11:07:13', '/uploads/edge_vision_1778929633847.jpg', 29, 'PENDING', NULL, 'UNLABELED', '/uploads/edge_vision_1778929633847.jpg'),
(44, '2026-05-16 11:08:33', '/uploads/edge_vision_1778929713285.jpg', 23, 'PENDING', NULL, 'UNLABELED', '/uploads/edge_vision_1778929713285.jpg'),
(45, '2026-05-16 11:08:58', '/uploads/edge_vision_1778929738190.jpg', 23, 'PENDING', NULL, 'UNLABELED', '/uploads/edge_vision_1778929738190.jpg');

--
-- Indexes for dumped tables
--

--
-- Indeks untuk tabel `visi_edge`
--
ALTER TABLE `visi_edge`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_waktu_tangkap` (`waktu_tangkap`);

--
-- AUTO_INCREMENT untuk tabel yang dibuang
--

--
-- AUTO_INCREMENT untuk tabel `visi_edge`
--
ALTER TABLE `visi_edge`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=46;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
