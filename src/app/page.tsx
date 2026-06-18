import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Products from "@/components/Products";
import History from "@/components/History";
import Properties from "@/components/Properties";
import Brands from "@/components/Brands";
import Sustainability from "@/components/Sustainability";
import Contact from "@/components/Contact";
import Footer from "@/components/Footer";
import Chatbot from "@/components/Chatbot";

export default function Home() {
  return (
    <main>
      <Navbar />
      <Hero />
      <Products />
      <History />
      <Properties />
      <Brands />
      <Sustainability />
      <Contact />
      <Footer />
      <Chatbot />
    </main>
  );
}
