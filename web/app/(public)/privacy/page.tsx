import Link from 'next/link'
import type { Metadata } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'
import { LEGAL } from '@/lib/legal'

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Política de Privacidad · VitalOS',
  description:
    'Cómo VitalOS recolecta, trata y protege los datos personales, conforme a la Ley 25.326 de Protección de los Datos Personales de Argentina.',
}

function Section({
  id,
  n,
  title,
  children,
}: {
  id: string
  n: number
  title: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-xl font-extrabold text-[#0F1720] mb-4 flex items-baseline gap-3">
        <span className="text-[#00C4BC] tabular-nums">{n}.</span>
        {title}
      </h2>
      <div className="space-y-4 text-[#374151] text-[15px] leading-relaxed">{children}</div>
    </section>
  )
}

export default function PrivacyPage() {
  const sections: { id: string; title: string }[] = [
    { id: 'alcance', title: 'Alcance y responsable' },
    { id: 'roles', title: 'Nuestro doble rol' },
    { id: 'datos', title: 'Qué datos tratamos' },
    { id: 'finalidades', title: 'Finalidades y base legal' },
    { id: 'pacientes', title: 'Datos de pacientes' },
    { id: 'destinatarios', title: 'Destinatarios y proveedores' },
    { id: 'transferencia', title: 'Transferencia internacional' },
    { id: 'conservacion', title: 'Plazo de conservación' },
    { id: 'seguridad', title: 'Seguridad de la información' },
    { id: 'derechos', title: 'Derechos de los titulares' },
    { id: 'cookies', title: 'Cookies y tecnologías similares' },
    { id: 'menores', title: 'Menores de edad' },
    { id: 'cambios', title: 'Cambios en esta política' },
    { id: 'contacto', title: 'Contacto y autoridad de control' },
  ]

  return (
    <div className={`${jakarta.className} min-h-screen bg-white`}>
      <header className="border-b border-[#F3F4F6] bg-white/90 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/" className="text-xl font-extrabold tracking-tight text-[#0F1720]">
            Vital<span className="text-[#00C4BC]">OS</span>
          </Link>
          <Link href="/register" className="text-sm font-semibold text-[#00C4BC] hover:underline">
            Crear cuenta
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <div className="mb-10">
          <h1 className="text-3xl font-extrabold text-[#0F1720] mb-3">Política de Privacidad</h1>
          <p className="text-[#6B7280] text-sm">
            Última actualización: {LEGAL.lastUpdated}. Esta política explica cómo VitalOS trata los datos
            personales. Se complementa con los{' '}
            <Link href="/terms" className="text-[#00C4BC] hover:underline">
              Términos y Condiciones
            </Link>{' '}
            y, para los datos de pacientes, con el{' '}
            <Link href="/dpa" className="text-[#00C4BC] hover:underline">
              Acuerdo de Tratamiento de Datos (DPA)
            </Link>
            .
          </p>
        </div>

        <nav className="mb-12 rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] p-5">
          <p className="text-xs font-bold text-[#0F1720] uppercase tracking-wider mb-3">Contenido</p>
          <ol className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm text-[#374151]">
            {sections.map((s, i) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="hover:text-[#00C4BC] transition-colors">
                  <span className="text-[#9CA3AF] tabular-nums mr-1.5">{i + 1}.</span>
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="space-y-10">
          <Section id="alcance" n={1} title="Alcance y responsable">
            <p>
              Esta Política de Privacidad se aplica al tratamiento de datos personales realizado a
              través del servicio VitalOS (el &quot;Servicio&quot;), conforme a la Ley N° 25.326 de
              Protección de los Datos Personales (&quot;LPDP&quot;), su Decreto reglamentario N°
              1558/2001 y las normas de la Agencia de Acceso a la Información Pública
              (&quot;AAIP&quot;).
            </p>
            <p>
              El responsable del Servicio es <strong>{LEGAL.operator}</strong>
              {LEGAL.taxId && <>, CUIT <strong>{LEGAL.taxId}</strong></>}, con domicilio de contacto
              en <strong>{LEGAL.address}</strong>, República Argentina (&quot;VitalOS&quot;,
              &quot;nosotros&quot;).
            </p>
          </Section>

          <Section id="roles" n={2} title="Nuestro doble rol">
            <p>En relación con los datos personales, VitalOS cumple dos roles distintos:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Como Responsable:</strong> respecto de los datos de las personas que crean y
                administran una cuenta (profesionales y personal de la organización cliente) y de los
                datos de registro, facturación y uso del Servicio. Esta política regula ese
                tratamiento.
              </li>
              <li>
                <strong>Como Encargado del tratamiento (art. 25 LPDP):</strong> respecto de los datos
                de los <strong>pacientes</strong> que el Cliente carga en el Servicio. En ese caso el
                Cliente es el Responsable y VitalOS trata los datos por su cuenta y según sus
                instrucciones, en los términos del{' '}
                <Link href="/dpa" className="text-[#00C4BC] hover:underline">
                  DPA
                </Link>
                .
              </li>
            </ul>
          </Section>

          <Section id="datos" n={3} title="Qué datos tratamos">
            <p>Como Responsable, tratamos las siguientes categorías de datos del Cliente:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Datos de registro e identidad:</strong> nombre, apellido, email, organización
                / consultorio, profesión o especialidad y, cuando corresponda, matrícula.
              </li>
              <li>
                <strong>Datos de cuenta y autenticación:</strong> credenciales (almacenadas de forma
                cifrada/hasheada por el proveedor de autenticación) y preferencias.
              </li>
              <li>
                <strong>Datos de facturación:</strong> datos fiscales y de la suscripción necesarios
                para cobrar el Servicio.
              </li>
              <li>
                <strong>Datos de uso y técnicos:</strong> registros de acceso, dirección IP, tipo de
                dispositivo y métricas de uso del Servicio.
              </li>
            </ul>
            <p>
              No solicitamos datos sensibles del Cliente. Los <strong>datos de salud de pacientes</strong>{' '}
              se describen en la sección 5.
            </p>
          </Section>

          <Section id="finalidades" n={4} title="Finalidades y base legal">
            <p>Tratamos los datos del Cliente para:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>crear y administrar la cuenta y prestar el Servicio (ejecución del contrato);</li>
              <li>facturar y gestionar los pagos (ejecución del contrato y obligación legal);</li>
              <li>brindar soporte y comunicarnos sobre el Servicio;</li>
              <li>
                mantener la seguridad, prevenir fraudes y auditar accesos (interés legítimo y deber de
                seguridad del art. 9 LPDP);
              </li>
              <li>mejorar el Servicio con información de uso, de forma agregada cuando es posible;</li>
              <li>cumplir obligaciones legales y requerimientos de autoridad competente.</li>
            </ul>
            <p>
              El consentimiento, cuando es la base aplicable, se recaba conforme al art. 5 LPDP y
              puede revocarse. El tratamiento necesario para la relación contractual no requiere
              consentimiento adicional (art. 5, inc. 2).
            </p>
          </Section>

          <Section id="pacientes" n={5} title="Datos de pacientes">
            <p>
              Los datos de pacientes (incluidos los <strong>datos de salud</strong>, que son datos
              sensibles) se cargan y administran por el Cliente, que actúa como Responsable. VitalOS
              los trata <strong>únicamente como Encargado</strong>, siguiendo las instrucciones del
              Cliente y con la única finalidad de prestar el Servicio; no los utiliza para fines
              propios ni los cede a terceros, salvo obligación legal.
            </p>
            <p>
              Si sos paciente de una organización que usa VitalOS y querés ejercer tus derechos o
              conocer el tratamiento de tus datos, debés dirigirte a esa organización (consultorio o
              clínica), que es la Responsable. Las condiciones de este tratamiento se detallan en el{' '}
              <Link href="/dpa" className="text-[#00C4BC] hover:underline">
                DPA
              </Link>
              .
            </p>
          </Section>

          <Section id="destinatarios" n={6} title="Destinatarios y proveedores">
            <p>
              No vendemos datos personales. Compartimos datos solo con proveedores que nos ayudan a
              prestar el Servicio, actuando como subencargados bajo obligaciones de confidencialidad y
              seguridad equivalentes. Entre las categorías de proveedores se incluyen:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>infraestructura de base de datos, autenticación y almacenamiento en la nube;</li>
              <li>servicio de gestión de claves de cifrado (KMS);</li>
              <li>colas, cache y procesamiento en segundo plano;</li>
              <li>envío de mensajes a pacientes (por ejemplo, recordatorios por WhatsApp/SMS/email);</li>
              <li>facturación electrónica y cobros;</li>
              <li>analítica de producto.</li>
            </ul>
            <p>
              También podremos divulgar datos cuando lo exija una obligación legal o un requerimiento
              de autoridad competente. El listado de subencargados vigente puede solicitarse por los
              canales de la sección 14.
            </p>
          </Section>

          <Section id="transferencia" n={7} title="Transferencia internacional">
            <p>
              Parte de la infraestructura (por ejemplo, el servicio de gestión de claves de cifrado y
              ciertos servicios de procesamiento) puede estar ubicada fuera de la República Argentina,
              lo que puede implicar una transferencia internacional de datos (art. 12 LPDP).
            </p>
            <p>
              Cuando la transferencia se dirija a países que no sean considerados de protección
              adecuada, la ampararemos en los mecanismos admitidos por la normativa argentina, como
              las cláusulas contractuales modelo aprobadas por la AAIP.
            </p>
          </Section>

          <Section id="conservacion" n={8} title="Plazo de conservación">
            <p>
              Conservamos los datos del Cliente mientras la cuenta esté activa y durante los plazos
              necesarios para cumplir obligaciones legales (por ejemplo, fiscales) o ejercer derechos.
              Dada de baja la cuenta, suprimimos o anonimizamos los datos vencido un plazo razonable,
              salvo los que debamos conservar por ley.
            </p>
            <p>
              La conservación de la <strong>historia clínica</strong> por el plazo legal (diez años,
              Ley N° 26.529) es responsabilidad del Cliente como custodio. VitalOS provee herramientas
              de exportación para facilitarlo.
            </p>
          </Section>

          <Section id="seguridad" n={9} title="Seguridad de la información">
            <p>
              Aplicamos medidas técnicas y organizativas alineadas con las recomendadas por la AAIP
              para datos de salud. En particular, los datos clínicos más sensibles se almacenan{' '}
              <strong>cifrados con AES-256-GCM</strong> mediante un esquema de envelope encryption
              (clave por organización protegida por una clave maestra en un KMS externo), el acceso se
              aísla por organización, el transporte va cifrado (HTTPS/TLS) y los archivos de pacientes
              se sirven solo mediante enlaces firmados temporales. El detalle figura en los{' '}
              <Link href="/terms#seguridad" className="text-[#00C4BC] hover:underline">
                Términos
              </Link>{' '}
              y en el Anexo del DPA. Ningún sistema es infalible; aplicamos medidas razonables y las
              mejoramos de forma continua.
            </p>
          </Section>

          <Section id="derechos" n={10} title="Derechos de los titulares">
            <p>
              Como titular de los datos, tenés derecho a solicitar el <strong>acceso</strong>,{' '}
              <strong>rectificación</strong>, <strong>actualización</strong> y{' '}
              <strong>supresión</strong> de tus datos, así como a oponerte y a revocar el
              consentimiento, en los términos de la LPDP. El derecho de acceso puede ejercerse en
              forma gratuita a intervalos no inferiores a seis meses, salvo interés legítimo
              acreditado (art. 14, inc. 3).
            </p>
            <p>
              Para ejercerlos, escribinos a{' '}
              <a href={`mailto:${LEGAL.emails.privacy}`} className="text-[#00C4BC] hover:underline">
                {LEGAL.emails.privacy}
              </a>
              . Si sos paciente, dirigite a la organización que trata tus datos (ver sección 5).
            </p>
          </Section>

          <Section id="cookies" n={11} title="Cookies y tecnologías similares">
            <p>
              Utilizamos cookies y tecnologías de almacenamiento local necesarias para el
              funcionamiento del Servicio (por ejemplo, para mantener la sesión) y, en su caso, para
              medir el uso y mejorar la experiencia. Podés gestionar las cookies desde la
              configuración de tu navegador; deshabilitar las necesarias puede afectar el
              funcionamiento del Servicio.
            </p>
          </Section>

          <Section id="menores" n={12} title="Menores de edad">
            <p>
              El Servicio está dirigido a profesionales y organizaciones de salud; no está pensado
              para que menores de edad creen cuentas. Los datos de pacientes menores que el Cliente
              cargue se tratan bajo la responsabilidad del Cliente, que debe contar con el
              consentimiento de quien ejerza la responsabilidad parental cuando corresponda.
            </p>
          </Section>

          <Section id="cambios" n={13} title="Cambios en esta política">
            <p>
              Podemos actualizar esta Política para reflejar cambios en el Servicio o en la
              normativa. Publicaremos la versión vigente en esta página con su fecha de actualización
              y, ante cambios sustanciales, procuraremos avisarte con antelación razonable.
            </p>
          </Section>

          <Section id="contacto" n={14} title="Contacto y autoridad de control">
            <p>
              Para consultas sobre privacidad o para ejercer tus derechos, escribinos a{' '}
              <a href={`mailto:${LEGAL.emails.privacy}`} className="text-[#00C4BC] hover:underline">
                {LEGAL.emails.privacy}
              </a>
              .
            </p>
            <p className="text-sm text-[#6B7280]">
              La Agencia de Acceso a la Información Pública (AAIP), órgano de control de la Ley N°
              25.326, tiene la atribución de atender las denuncias y reclamos que se interpongan con
              relación al incumplimiento de las normas sobre protección de datos personales.
            </p>
          </Section>
        </div>

        <div className="mt-16 pt-8 border-t border-[#F3F4F6] flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-[#9CA3AF]">© {new Date().getFullYear()} VitalOS. Todos los derechos reservados.</p>
          <div className="flex items-center gap-5 text-sm">
            <Link href="/terms" className="text-[#6B7280] hover:text-[#00C4BC] transition-colors">
              Términos
            </Link>
            <Link href="/dpa" className="text-[#6B7280] hover:text-[#00C4BC] transition-colors">
              DPA
            </Link>
            <Link href="/register" className="text-[#00C4BC] font-semibold hover:underline">
              Crear cuenta
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
